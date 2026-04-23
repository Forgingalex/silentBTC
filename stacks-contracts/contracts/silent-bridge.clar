;; silentBTC - Secure Native Intent Protocol
;; Hardened three-asset escrow for STX, sBTC, and USDCx.

(define-constant CONTRACT_OWNER tx-sender)

;; Error Codes
(define-constant ERR_UNAUTHORIZED (err u4001))
(define-constant ERR_INVALID_AMOUNT (err u4002))
(define-constant ERR_NO_INTENT_FOUND (err u4003))
(define-constant ERR_ALREADY_FULFILLED (err u4004))
(define-constant ERR_INTENT_EXISTS (err u4005))
(define-constant ERR_INSUFFICIENT_LIQUIDITY (err u4006))

(define-data-var escrowed-stx uint u0)
(define-data-var escrowed-sbtc uint u0)
(define-data-var escrowed-usdcx uint u0)
(define-data-var liquidity-stx uint u0)
(define-data-var liquidity-sbtc uint u0)
(define-data-var liquidity-usdcx uint u0)

(define-map swap-intents
    principal
    {
        amount: uint,
        from-asset: (string-ascii 10),
        to-asset: (string-ascii 10),
        preference: (string-ascii 12),
        status: (string-ascii 12)
    }
)

(define-private (record-intent
    (amount uint)
    (from-asset (string-ascii 10))
    (to-asset (string-ascii 10))
    (preference (string-ascii 12))
)
    (begin
        (asserts! (> amount u0) ERR_INVALID_AMOUNT)
        (asserts! (is-none (map-get? swap-intents tx-sender)) ERR_INTENT_EXISTS)
        (map-set swap-intents tx-sender {
            amount: amount,
            from-asset: from-asset,
            to-asset: to-asset,
            preference: preference,
            status: "pending"
        })
        (ok true)
    )
)

;; --- User Functions ---

(define-public (lock-stx-for-sbtc (amount uint) (preference (string-ascii 12)))
    (begin
        (try! (record-intent amount "STX" "sBTC" preference))
        (try! (stx-transfer? amount tx-sender (as-contract tx-sender)))
        (var-set escrowed-stx (+ (var-get escrowed-stx) amount))
        (ok true)
    )
)

(define-public (lock-stx-for-usdcx (amount uint) (preference (string-ascii 12)))
    (begin
        (try! (record-intent amount "STX" "USDCx" preference))
        (try! (stx-transfer? amount tx-sender (as-contract tx-sender)))
        (var-set escrowed-stx (+ (var-get escrowed-stx) amount))
        (ok true)
    )
)

(define-public (lock-sbtc-for-stx (amount uint) (preference (string-ascii 12)))
    (begin
        (try! (record-intent amount "sBTC" "STX" preference))
        (try! (contract-call? 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token transfer amount tx-sender (as-contract tx-sender) none))
        (var-set escrowed-sbtc (+ (var-get escrowed-sbtc) amount))
        (ok true)
    )
)

(define-public (lock-sbtc-for-usdcx (amount uint) (preference (string-ascii 12)))
    (begin
        (try! (record-intent amount "sBTC" "USDCx" preference))
        (try! (contract-call? 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token transfer amount tx-sender (as-contract tx-sender) none))
        (var-set escrowed-sbtc (+ (var-get escrowed-sbtc) amount))
        (ok true)
    )
)

(define-public (lock-usdcx-for-stx (amount uint) (preference (string-ascii 12)))
    (begin
        (try! (record-intent amount "USDCx" "STX" preference))
        (try! (contract-call? .usdcx-token transfer amount tx-sender (as-contract tx-sender) none))
        (var-set escrowed-usdcx (+ (var-get escrowed-usdcx) amount))
        (ok true)
    )
)

(define-public (lock-usdcx-for-sbtc (amount uint) (preference (string-ascii 12)))
    (begin
        (try! (record-intent amount "USDCx" "sBTC" preference))
        (try! (contract-call? .usdcx-token transfer amount tx-sender (as-contract tx-sender) none))
        (var-set escrowed-usdcx (+ (var-get escrowed-usdcx) amount))
        (ok true)
    )
)

;; @desc Users can reclaim funds if their intent is still pending.
(define-public (reclaim-escrow)
    (let (
        (caller tx-sender)
        (intent (unwrap! (map-get? swap-intents caller) ERR_NO_INTENT_FOUND))
        (amount (get amount intent))
        (asset (get from-asset intent))
    )
        (asserts! (is-eq (get status intent) "pending") ERR_ALREADY_FULFILLED)

        (if (is-eq asset "STX")
            (begin
                (try! (as-contract (stx-transfer? amount tx-sender caller)))
                (var-set escrowed-stx (- (var-get escrowed-stx) amount))
            )
            (if (is-eq asset "sBTC")
                (begin
                    (try! (as-contract (contract-call? 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token transfer amount tx-sender caller none)))
                    (var-set escrowed-sbtc (- (var-get escrowed-sbtc) amount))
                )
                (begin
                    (try! (as-contract (contract-call? .usdcx-token transfer amount tx-sender caller none)))
                    (var-set escrowed-usdcx (- (var-get escrowed-usdcx) amount))
                )
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

(define-public (provide-usdcx-liquidity (amount uint))
    (begin
        (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_UNAUTHORIZED)
        (asserts! (> amount u0) ERR_INVALID_AMOUNT)
        (try! (contract-call? .usdcx-token transfer amount tx-sender (as-contract tx-sender) none))
        (var-set liquidity-usdcx (+ (var-get liquidity-usdcx) amount))
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

(define-public (withdraw-usdcx-liquidity (amount uint))
    (begin
        (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_UNAUTHORIZED)
        (asserts! (> amount u0) ERR_INVALID_AMOUNT)
        (asserts! (>= (var-get liquidity-usdcx) amount) ERR_INSUFFICIENT_LIQUIDITY)
        (try! (as-contract (contract-call? .usdcx-token transfer amount tx-sender CONTRACT_OWNER none)))
        (var-set liquidity-usdcx (- (var-get liquidity-usdcx) amount))
        (ok true)
    )
)

;; @desc Owner fulfills a pending swap by paying the selected output asset from contract liquidity.
(define-public (fulfill-swap (user principal) (output-amount uint))
    (let (
        (intent (unwrap! (map-get? swap-intents user) ERR_NO_INTENT_FOUND))
        (from-asset (get from-asset intent))
        (to-asset (get to-asset intent))
        (input-amount (get amount intent))
    )
        (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_UNAUTHORIZED)
        (asserts! (> output-amount u0) ERR_INVALID_AMOUNT)
        (asserts! (is-eq (get status intent) "pending") ERR_ALREADY_FULFILLED)

        (if (is-eq to-asset "STX")
            (begin
                (asserts! (>= (var-get liquidity-stx) output-amount) ERR_INSUFFICIENT_LIQUIDITY)
                (try! (as-contract (stx-transfer? output-amount tx-sender user)))
                (var-set liquidity-stx (- (var-get liquidity-stx) output-amount))
            )
            (if (is-eq to-asset "sBTC")
                (begin
                    (asserts! (>= (var-get liquidity-sbtc) output-amount) ERR_INSUFFICIENT_LIQUIDITY)
                    (try! (as-contract (contract-call? 'SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token transfer output-amount tx-sender user none)))
                    (var-set liquidity-sbtc (- (var-get liquidity-sbtc) output-amount))
                )
                (begin
                    (asserts! (>= (var-get liquidity-usdcx) output-amount) ERR_INSUFFICIENT_LIQUIDITY)
                    (try! (as-contract (contract-call? .usdcx-token transfer output-amount tx-sender user none)))
                    (var-set liquidity-usdcx (- (var-get liquidity-usdcx) output-amount))
                )
            )
        )

        (if (is-eq from-asset "STX")
            (begin
                (var-set escrowed-stx (- (var-get escrowed-stx) input-amount))
                (var-set liquidity-stx (+ (var-get liquidity-stx) input-amount))
            )
            (if (is-eq from-asset "sBTC")
                (begin
                    (var-set escrowed-sbtc (- (var-get escrowed-sbtc) input-amount))
                    (var-set liquidity-sbtc (+ (var-get liquidity-sbtc) input-amount))
                )
                (begin
                    (var-set escrowed-usdcx (- (var-get escrowed-usdcx) input-amount))
                    (var-set liquidity-usdcx (+ (var-get liquidity-usdcx) input-amount))
                )
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
        escrowed-usdcx: (var-get escrowed-usdcx),
        liquidity-stx: (var-get liquidity-stx),
        liquidity-sbtc: (var-get liquidity-sbtc),
        liquidity-usdcx: (var-get liquidity-usdcx)
    }
)
