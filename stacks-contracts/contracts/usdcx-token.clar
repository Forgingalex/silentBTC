;; USDCx - SIP-010 compatible settlement token for silentBTC deployments.
;; Mainnet deployments should replace this contract with the audited USDCx issuer if one exists.

(define-fungible-token usdcx-token)

(define-constant CONTRACT_OWNER tx-sender)
(define-constant ERR_UNAUTHORIZED (err u5001))
(define-constant ERR_INVALID_AMOUNT (err u5002))

(define-public (transfer (amount uint) (sender principal) (recipient principal) (memo (optional (buff 34))))
    (begin
        (asserts! (> amount u0) ERR_INVALID_AMOUNT)
        (asserts! (is-eq tx-sender sender) ERR_UNAUTHORIZED)
        (try! (ft-transfer? usdcx-token amount sender recipient))
        (match memo memo-value (print memo-value) 0x)
        (ok true)
    )
)

(define-public (mint (amount uint) (recipient principal))
    (begin
        (asserts! (is-eq tx-sender CONTRACT_OWNER) ERR_UNAUTHORIZED)
        (asserts! (> amount u0) ERR_INVALID_AMOUNT)
        (ft-mint? usdcx-token amount recipient)
    )
)

(define-read-only (get-name)
    (ok "USDCx")
)

(define-read-only (get-symbol)
    (ok "USDCx")
)

(define-read-only (get-decimals)
    (ok u6)
)

(define-read-only (get-balance (owner principal))
    (ok (ft-get-balance usdcx-token owner))
)

(define-read-only (get-total-supply)
    (ok (ft-get-supply usdcx-token))
)

(define-read-only (get-token-uri)
    (ok none)
)
