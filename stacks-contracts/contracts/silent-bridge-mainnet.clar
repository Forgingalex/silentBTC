;; silentBTC - Mainnet release track
;; STX <-> sBTC only, with minimum output constraints for solver fulfillment.

(define-constant CONTRACT_OWNER tx-sender)
;; Error Codes
(define-constant ERR_UNAUTHORIZED (err u5001))
(define-constant ERR_INVALID_AMOUNT (err u5002))
(define-constant ERR_NO_INTENT_FOUND (err u5003))
(define-constant ERR_ALREADY_FULFILLED (err u5004))
(define-constant ERR_INTENT_EXISTS (err u5005))
(define-constant ERR_INSUFFICIENT_LIQUIDITY (err u5006))
(define-constant ERR_BELOW_MIN_OUTPUT (err u5007))

(define-data-var escrowed-stx uint u0)
(define-data-var escrowed-sbtc uint u0)
(define-data-var liquidity-stx uint u0)
(define-data-var liquidity-sbtc uint u0)

(define-map swap-intents
    principal
    {
        input-amount: uint,
        min-output-amount: uint,
        from-asset: (string-ascii 4),
        to-asset: (string-ascii 4),
        preference: (string-ascii 12),
        status: (string-ascii 12),
        created-at: uint
    }
)

(define-private (record-intent
    (input-amount uint)
    (min-output-amount uint)
    (from-asset (string-ascii 4))
    (to-asset (string-ascii 4))
    (preference (string-ascii 12))
)
    (begin
        (asserts! (> input-amount u0) ERR_INVALID_AMOUNT)
        (asserts! (> min-output-amount u0) ERR_INVALID_AMOUNT)
        (asserts! (is-none (map-get? swap-intents tx-sender)) ERR_INTENT_EXISTS)
        (map-set swap-intents tx-sender {
            input-amount: input-amount,
            min-output-amount: min-output-amount,
            from-asset: from-asset,
            to-asset: to-asset,
            preference: preference,
            status: "pending",
            created-at: stacks-block-height
        })
        (ok true)
    )
)

;; --- User Functions ---

(define-public (lock-stx-for-sbtc (amount uint) (min-output-amount uint) (preference (string-ascii 12)))
    (begin
        (try! (record-intent amount min-output-amount "STX" "sBTC" preference))
        (try! (stx-transfer? amount tx-sender (as-contract tx-sender)))
        (var-set escrowed-stx (+ (var-get escrowed-stx) amount))
        (ok true)
    )
)

(define-public (lock-sbtc-for-stx (amount uint) (min-output-amount uint) (preference (string-ascii 12)))
    (begin
        (try! (record-intent amount min-output-amount "sBTC" "STX" preference))
        (try! (contract-call? 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token transfer amount tx-sender (as-contract tx-sender) none))
        (var-set escrowed-sbtc (+ (var-get escrowed-sbtc) amount))
        (ok true)
    )
)

(define-public (reclaim-escrow)
    (let (
        (caller tx-sender)
        (intent (unwrap! (map-get? swap-intents caller) ERR_NO_INTENT_FOUND))
        (input-amount (get input-amount intent))
        (asset (get from-asset intent))
    )
        (asserts! (is-eq (get status intent) "pending") ERR_ALREADY_FULFILLED)

        (if (is-eq asset "STX")
            (begin
                (try! (as-contract (stx-transfer? input-amount tx-sender caller)))
                (var-set escrowed-stx (- (var-get escrowed-stx) input-amount))
            )
            (begin
                (try! (as-contract (contract-call? 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token transfer input-amount tx-sender caller none)))
                (var-set escrowed-sbtc (- (var-get escrowed-sbtc) input-amount))
            )
        )

        (map-delete swap-intents caller)
        (ok true)
    )
)

;; --- Admin/Solver Functions ---

(define-public (provide-stx-liquidity (amount uint))
    (begin
        (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_UNAUTHORIZED)
        (asserts! (> amount u0) ERR_INVALID_AMOUNT)
        (try! (stx-transfer? amount tx-sender (as-contract tx-sender)))
        (var-set liquidity-stx (+ (var-get liquidity-stx) amount))
        (ok true)
    )
)

(define-public (provide-sbtc-liquidity (amount uint))
    (begin
        (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_UNAUTHORIZED)
        (asserts! (> amount u0) ERR_INVALID_AMOUNT)
        (try! (contract-call? 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token transfer amount tx-sender (as-contract tx-sender) none))
        (var-set liquidity-sbtc (+ (var-get liquidity-sbtc) amount))
        (ok true)
    )
)

(define-public (withdraw-stx-liquidity (amount uint))
    (begin
        (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_UNAUTHORIZED)
        (asserts! (> amount u0) ERR_INVALID_AMOUNT)
        (asserts! (>= (var-get liquidity-stx) amount) ERR_INSUFFICIENT_LIQUIDITY)
        (try! (as-contract (stx-transfer? amount tx-sender CONTRACT_OWNER)))
        (var-set liquidity-stx (- (var-get liquidity-stx) amount))
        (ok true)
    )
)

(define-public (withdraw-sbtc-liquidity (amount uint))
    (begin
        (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_UNAUTHORIZED)
        (asserts! (> amount u0) ERR_INVALID_AMOUNT)
        (asserts! (>= (var-get liquidity-sbtc) amount) ERR_INSUFFICIENT_LIQUIDITY)
        (try! (as-contract (contract-call? 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token transfer amount tx-sender CONTRACT_OWNER none)))
        (var-set liquidity-sbtc (- (var-get liquidity-sbtc) amount))
        (ok true)
    )
)

(define-public (fulfill-swap (user principal) (output-amount uint))
    (let (
        (intent (unwrap! (map-get? swap-intents user) ERR_NO_INTENT_FOUND))
        (from-asset (get from-asset intent))
        (to-asset (get to-asset intent))
        (input-amount (get input-amount intent))
        (min-output-amount (get min-output-amount intent))
    )
        (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_UNAUTHORIZED)
        (asserts! (> output-amount u0) ERR_INVALID_AMOUNT)
        (asserts! (is-eq (get status intent) "pending") ERR_ALREADY_FULFILLED)
        (asserts! (>= output-amount min-output-amount) ERR_BELOW_MIN_OUTPUT)

        (if (is-eq to-asset "STX")
            (begin
                (asserts! (>= (var-get liquidity-stx) output-amount) ERR_INSUFFICIENT_LIQUIDITY)
                (try! (as-contract (stx-transfer? output-amount tx-sender user)))
                (var-set liquidity-stx (- (var-get liquidity-stx) output-amount))
            )
            (begin
                (asserts! (>= (var-get liquidity-sbtc) output-amount) ERR_INSUFFICIENT_LIQUIDITY)
                (try! (as-contract (contract-call? 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token transfer output-amount tx-sender user none)))
                (var-set liquidity-sbtc (- (var-get liquidity-sbtc) output-amount))
            )
        )

        (if (is-eq from-asset "STX")
            (begin
                (var-set escrowed-stx (- (var-get escrowed-stx) input-amount))
                (var-set liquidity-stx (+ (var-get liquidity-stx) input-amount))
            )
            (begin
                (var-set escrowed-sbtc (- (var-get escrowed-sbtc) input-amount))
                (var-set liquidity-sbtc (+ (var-get liquidity-sbtc) input-amount))
            )
        )

        (map-delete swap-intents user)
        (ok true)
    )
)

(define-read-only (get-intent (user principal))
    (map-get? swap-intents user)
)

(define-read-only (get-accounting)
    {
        escrowed-stx: (var-get escrowed-stx),
        escrowed-sbtc: (var-get escrowed-sbtc),
        liquidity-stx: (var-get liquidity-stx),
        liquidity-sbtc: (var-get liquidity-sbtc)
    }
)
