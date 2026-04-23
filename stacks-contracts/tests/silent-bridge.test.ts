import { Cl } from "@stacks/transactions";
import { describe, expect, it } from "vitest";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const user1 = accounts.get("wallet_1")!;
const CONTRACT_NAME = "silent-bridge-v2";
const USDCX_TOKEN = "usdcx-token";

const expectIntent = (
  user: string,
  amount: number,
  fromAsset: string,
  toAsset: string,
  preference: string
) => {
  const intent = simnet.callReadOnlyFn(
    CONTRACT_NAME,
    "get-intent",
    [Cl.standardPrincipal(user)],
    user
  );

  expect(intent.result).toEqual(
    Cl.some(
      Cl.tuple({
        amount: Cl.uint(amount),
        "from-asset": Cl.stringAscii(fromAsset),
        "to-asset": Cl.stringAscii(toAsset),
        preference: Cl.stringAscii(preference),
        status: Cl.stringAscii("pending"),
      })
    )
  );
};

const mintUsdcx = (recipient: string, amount: number) =>
  simnet.callPublicFn(
    USDCX_TOKEN,
    "mint",
    [Cl.uint(amount), Cl.standardPrincipal(recipient)],
    deployer
  );

describe("silentBTC: Secure Native Intent Protocol", () => {
  it("escrows STX and records an sBTC swap intent", () => {
    const amount = 1_000_000; // 1.0 STX in micro-STX
    const preference = "fastest";

    const { result } = simnet.callPublicFn(
      CONTRACT_NAME,
      "lock-stx-for-sbtc",
      [Cl.uint(amount), Cl.stringAscii(preference)],
      user1
    );

    expect(result).toBeOk(Cl.bool(true));

    expectIntent(user1, amount, "STX", "sBTC", preference);
  });

  it("escrows sBTC and records an STX swap intent", () => {
    const amount = 100_000_000; // 1.0 sBTC in satoshis
    const preference = "cheapest";

    const { result } = simnet.callPublicFn(
      CONTRACT_NAME,
      "lock-sbtc-for-stx",
      [Cl.uint(amount), Cl.stringAscii(preference)],
      user1
    );

    expect(result).toBeOk(Cl.bool(true));

    expectIntent(user1, amount, "sBTC", "STX", preference);
  });

  it("escrows STX and records a USDCx swap intent", () => {
    const amount = 5_000_000;
    const preference = "fastest";

    const { result } = simnet.callPublicFn(
      CONTRACT_NAME,
      "lock-stx-for-usdcx",
      [Cl.uint(amount), Cl.stringAscii(preference)],
      user1
    );

    expect(result).toBeOk(Cl.bool(true));
    expectIntent(user1, amount, "STX", "USDCx", preference);
  });

  it("escrows USDCx and records an STX swap intent", () => {
    const amount = 10_000_000;
    const preference = "cheapest";

    mintUsdcx(user1, amount);

    const { result } = simnet.callPublicFn(
      CONTRACT_NAME,
      "lock-usdcx-for-stx",
      [Cl.uint(amount), Cl.stringAscii(preference)],
      user1
    );

    expect(result).toBeOk(Cl.bool(true));
    expectIntent(user1, amount, "USDCx", "STX", preference);
  });

  it("escrows sBTC and records a USDCx swap intent", () => {
    const amount = 50_000_000;
    const preference = "fastest";

    const { result } = simnet.callPublicFn(
      CONTRACT_NAME,
      "lock-sbtc-for-usdcx",
      [Cl.uint(amount), Cl.stringAscii(preference)],
      user1
    );

    expect(result).toBeOk(Cl.bool(true));
    expectIntent(user1, amount, "sBTC", "USDCx", preference);
  });

  it("escrows USDCx and records an sBTC swap intent", () => {
    const amount = 15_000_000;
    const preference = "cheapest";

    mintUsdcx(user1, amount);

    const { result } = simnet.callPublicFn(
      CONTRACT_NAME,
      "lock-usdcx-for-sbtc",
      [Cl.uint(amount), Cl.stringAscii(preference)],
      user1
    );

    expect(result).toBeOk(Cl.bool(true));
    expectIntent(user1, amount, "USDCx", "sBTC", preference);
  });

  it("lets users reclaim pending STX escrow", () => {
    const amount = 2_000_000;

    simnet.callPublicFn(
      CONTRACT_NAME,
      "lock-stx-for-sbtc",
      [Cl.uint(amount), Cl.stringAscii("fastest")],
      user1
    );

    const { result } = simnet.callPublicFn(
      CONTRACT_NAME,
      "reclaim-escrow",
      [],
      user1
    );

    expect(result).toBeOk(Cl.bool(true));

    const intent = simnet.callReadOnlyFn(
      CONTRACT_NAME,
      "get-intent",
      [Cl.standardPrincipal(user1)],
      user1
    );

    expect(intent.result).toEqual(Cl.none());
  });

  it("lets users reclaim pending sBTC escrow", () => {
    const amount = 100_000_000;

    simnet.callPublicFn(
      CONTRACT_NAME,
      "lock-sbtc-for-stx",
      [Cl.uint(amount), Cl.stringAscii("cheapest")],
      user1
    );

    const { result } = simnet.callPublicFn(
      CONTRACT_NAME,
      "reclaim-escrow",
      [],
      user1
    );

    expect(result).toBeOk(Cl.bool(true));

    const intent = simnet.callReadOnlyFn(
      CONTRACT_NAME,
      "get-intent",
      [Cl.standardPrincipal(user1)],
      user1
    );

    expect(intent.result).toEqual(Cl.none());
  });

  it("lets users reclaim pending USDCx escrow", () => {
    const amount = 25_000_000;

    mintUsdcx(user1, amount);

    simnet.callPublicFn(
      CONTRACT_NAME,
      "lock-usdcx-for-stx",
      [Cl.uint(amount), Cl.stringAscii("fastest")],
      user1
    );

    const { result } = simnet.callPublicFn(
      CONTRACT_NAME,
      "reclaim-escrow",
      [],
      user1
    );

    expect(result).toBeOk(Cl.bool(true));

    const intent = simnet.callReadOnlyFn(
      CONTRACT_NAME,
      "get-intent",
      [Cl.standardPrincipal(user1)],
      user1
    );

    expect(intent.result).toEqual(Cl.none());
  });

  it("allows the owner to fulfill STX-to-sBTC intents from contract sBTC liquidity", () => {
    const inputAmount = 1_000_000;
    const outputAmount = 100_000_000;

    simnet.callPublicFn(
      CONTRACT_NAME,
      "provide-sbtc-liquidity",
      [Cl.uint(outputAmount)],
      deployer
    );

    simnet.callPublicFn(
      CONTRACT_NAME,
      "lock-stx-for-sbtc",
      [Cl.uint(inputAmount), Cl.stringAscii("fastest")],
      user1
    );

    const { result } = simnet.callPublicFn(
      CONTRACT_NAME,
      "fulfill-swap",
      [Cl.standardPrincipal(user1), Cl.uint(outputAmount)],
      deployer
    );

    expect(result).toBeOk(Cl.bool(true));

    const intent = simnet.callReadOnlyFn(
      CONTRACT_NAME,
      "get-intent",
      [Cl.standardPrincipal(user1)],
      user1
    );

    expect(intent.result).toEqual(Cl.none());
  });

  it("allows the owner to fulfill sBTC-to-STX intents from contract STX liquidity", () => {
    const inputAmount = 100_000_000;
    const outputAmount = 1_000_000;

    simnet.callPublicFn(
      CONTRACT_NAME,
      "provide-stx-liquidity",
      [Cl.uint(outputAmount)],
      deployer
    );

    simnet.callPublicFn(
      CONTRACT_NAME,
      "lock-sbtc-for-stx",
      [Cl.uint(inputAmount), Cl.stringAscii("cheapest")],
      user1
    );

    const { result } = simnet.callPublicFn(
      CONTRACT_NAME,
      "fulfill-swap",
      [Cl.standardPrincipal(user1), Cl.uint(outputAmount)],
      deployer
    );

    expect(result).toBeOk(Cl.bool(true));

    const intent = simnet.callReadOnlyFn(
      CONTRACT_NAME,
      "get-intent",
      [Cl.standardPrincipal(user1)],
      user1
    );

    expect(intent.result).toEqual(Cl.none());
  });

  it("allows the owner to fulfill STX-to-USDCx intents from contract USDCx liquidity", () => {
    const inputAmount = 1_000_000;
    const outputAmount = 2_000_000;

    mintUsdcx(deployer, outputAmount);

    simnet.callPublicFn(
      CONTRACT_NAME,
      "provide-usdcx-liquidity",
      [Cl.uint(outputAmount)],
      deployer
    );

    simnet.callPublicFn(
      CONTRACT_NAME,
      "lock-stx-for-usdcx",
      [Cl.uint(inputAmount), Cl.stringAscii("fastest")],
      user1
    );

    const { result } = simnet.callPublicFn(
      CONTRACT_NAME,
      "fulfill-swap",
      [Cl.standardPrincipal(user1), Cl.uint(outputAmount)],
      deployer
    );

    expect(result).toBeOk(Cl.bool(true));

    const intent = simnet.callReadOnlyFn(
      CONTRACT_NAME,
      "get-intent",
      [Cl.standardPrincipal(user1)],
      user1
    );

    expect(intent.result).toEqual(Cl.none());
  });

  it("allows the owner to fulfill USDCx-to-sBTC intents from contract sBTC liquidity", () => {
    const inputAmount = 2_000_000;
    const outputAmount = 10_000_000;

    mintUsdcx(user1, inputAmount);

    simnet.callPublicFn(
      CONTRACT_NAME,
      "provide-sbtc-liquidity",
      [Cl.uint(outputAmount)],
      deployer
    );

    simnet.callPublicFn(
      CONTRACT_NAME,
      "lock-usdcx-for-sbtc",
      [Cl.uint(inputAmount), Cl.stringAscii("cheapest")],
      user1
    );

    const { result } = simnet.callPublicFn(
      CONTRACT_NAME,
      "fulfill-swap",
      [Cl.standardPrincipal(user1), Cl.uint(outputAmount)],
      deployer
    );

    expect(result).toBeOk(Cl.bool(true));

    const intent = simnet.callReadOnlyFn(
      CONTRACT_NAME,
      "get-intent",
      [Cl.standardPrincipal(user1)],
      user1
    );

    expect(intent.result).toEqual(Cl.none());
  });

  it("rejects fulfillment when paired asset liquidity is insufficient", () => {
    simnet.callPublicFn(
      CONTRACT_NAME,
      "lock-stx-for-sbtc",
      [Cl.uint(1_000_000), Cl.stringAscii("fastest")],
      user1
    );

    const { result } = simnet.callPublicFn(
      CONTRACT_NAME,
      "fulfill-swap",
      [Cl.standardPrincipal(user1), Cl.uint(100_000_000)],
      deployer
    );

    expect(result).toBeErr(Cl.uint(4006));
  });

  it("rejects fulfillment from non-owner callers", () => {
    simnet.callPublicFn(
      CONTRACT_NAME,
      "lock-stx-for-sbtc",
      [Cl.uint(1_000_000), Cl.stringAscii("fastest")],
      user1
    );

    const { result } = simnet.callPublicFn(
      CONTRACT_NAME,
      "fulfill-swap",
      [Cl.standardPrincipal(user1), Cl.uint(100_000_000)],
      user1
    );

    expect(result).toBeErr(Cl.uint(4001));
  });

  it("prevents duplicate pending intents from overwriting escrow accounting", () => {
    simnet.callPublicFn(
      CONTRACT_NAME,
      "lock-stx-for-sbtc",
      [Cl.uint(1_000_000), Cl.stringAscii("fastest")],
      user1
    );

    const { result } = simnet.callPublicFn(
      CONTRACT_NAME,
      "lock-sbtc-for-stx",
      [Cl.uint(100_000_000), Cl.stringAscii("cheapest")],
      user1
    );

    expect(result).toBeErr(Cl.uint(4005));
  });

  it("rejects reclaim attempts when no intent exists", () => {
    const { result } = simnet.callPublicFn(
      CONTRACT_NAME,
      "reclaim-escrow",
      [],
      user1
    );

    expect(result).toBeErr(Cl.uint(4003));
  });

  it("rejects zero-value STX intents", () => {
    const { result } = simnet.callPublicFn(
      CONTRACT_NAME,
      "lock-stx-for-sbtc",
      [Cl.uint(0), Cl.stringAscii("fastest")],
      user1
    );

    expect(result).toBeErr(Cl.uint(4002));
  });

  it("rejects zero-value sBTC intents before token transfer", () => {
    const { result } = simnet.callPublicFn(
      CONTRACT_NAME,
      "lock-sbtc-for-stx",
      [Cl.uint(0), Cl.stringAscii("cheapest")],
      user1
    );

    expect(result).toBeErr(Cl.uint(4002));
  });

  it("rejects zero-value USDCx intents before token transfer", () => {
    const { result } = simnet.callPublicFn(
      CONTRACT_NAME,
      "lock-usdcx-for-stx",
      [Cl.uint(0), Cl.stringAscii("cheapest")],
      user1
    );

    expect(result).toBeErr(Cl.uint(4002));
  });
});
