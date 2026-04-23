import { Cl } from "@stacks/transactions";
import { describe, expect, it } from "vitest";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const user1 = accounts.get("wallet_1")!;
const CONTRACT_NAME = "silent-bridge-mainnet";

const expectIntent = (
  user: string,
  inputAmount: number,
  minOutputAmount: number,
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

  expect(intent.result.type).toEqual(Cl.some(Cl.bool(true)).type);
  if (intent.result.type !== "some") {
    throw new Error("Expected a stored intent.");
  }

  const tuple = intent.result.value;
  expect(tuple.type).toEqual("tuple");
  if (tuple.type !== "tuple") {
    throw new Error("Expected tuple intent data.");
  }

  expect(tuple.value["from-asset"]).toEqual(Cl.stringAscii(fromAsset));
  expect(tuple.value["input-amount"]).toEqual(Cl.uint(inputAmount));
  expect(tuple.value["min-output-amount"]).toEqual(Cl.uint(minOutputAmount));
  expect(tuple.value.preference).toEqual(Cl.stringAscii(preference));
  expect(tuple.value.status).toEqual(Cl.stringAscii("pending"));
  expect(tuple.value["to-asset"]).toEqual(Cl.stringAscii(toAsset));
  expect(tuple.value["created-at"]).toEqual(expect.objectContaining({ type: "uint" }));
};

describe("silentBTC: Mainnet release track", () => {
  it("escrows STX and stores a minimum sBTC output", () => {
    const inputAmount = 1_000_000;
    const minOutputAmount = 90_000_000;

    const { result } = simnet.callPublicFn(
      CONTRACT_NAME,
      "lock-stx-for-sbtc",
      [Cl.uint(inputAmount), Cl.uint(minOutputAmount), Cl.stringAscii("fastest")],
      user1
    );

    expect(result).toBeOk(Cl.bool(true));
    expectIntent(user1, inputAmount, minOutputAmount, "STX", "sBTC", "fastest");
  });

  it("escrows sBTC and stores a minimum STX output", () => {
    const inputAmount = 100_000_000;
    const minOutputAmount = 900_000;

    const { result } = simnet.callPublicFn(
      CONTRACT_NAME,
      "lock-sbtc-for-stx",
      [Cl.uint(inputAmount), Cl.uint(minOutputAmount), Cl.stringAscii("cheapest")],
      user1
    );

    expect(result).toBeOk(Cl.bool(true));
    expectIntent(user1, inputAmount, minOutputAmount, "sBTC", "STX", "cheapest");
  });

  it("rejects zero minimum output on lock", () => {
    const { result } = simnet.callPublicFn(
      CONTRACT_NAME,
      "lock-stx-for-sbtc",
      [Cl.uint(1_000_000), Cl.uint(0), Cl.stringAscii("fastest")],
      user1
    );

    expect(result).toBeErr(Cl.uint(5002));
  });

  it("lets the owner fulfill when the output meets the user floor", () => {
    const inputAmount = 1_000_000;
    const minOutputAmount = 75_000_000;
    const outputAmount = 80_000_000;

    simnet.callPublicFn(
      CONTRACT_NAME,
      "provide-sbtc-liquidity",
      [Cl.uint(outputAmount)],
      deployer
    );

    simnet.callPublicFn(
      CONTRACT_NAME,
      "lock-stx-for-sbtc",
      [Cl.uint(inputAmount), Cl.uint(minOutputAmount), Cl.stringAscii("fastest")],
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

  it("rejects fulfillments that price below the user floor", () => {
    const inputAmount = 1_000_000;
    const minOutputAmount = 95_000_000;
    const outputAmount = 90_000_000;

    simnet.callPublicFn(
      CONTRACT_NAME,
      "provide-sbtc-liquidity",
      [Cl.uint(minOutputAmount)],
      deployer
    );

    simnet.callPublicFn(
      CONTRACT_NAME,
      "lock-stx-for-sbtc",
      [Cl.uint(inputAmount), Cl.uint(minOutputAmount), Cl.stringAscii("fastest")],
      user1
    );

    const { result } = simnet.callPublicFn(
      CONTRACT_NAME,
      "fulfill-swap",
      [Cl.standardPrincipal(user1), Cl.uint(outputAmount)],
      deployer
    );

    expect(result).toBeErr(Cl.uint(5007));
  });

  it("lets users reclaim pending escrow", () => {
    const inputAmount = 2_000_000;
    const minOutputAmount = 100_000_000;

    simnet.callPublicFn(
      CONTRACT_NAME,
      "lock-stx-for-sbtc",
      [Cl.uint(inputAmount), Cl.uint(minOutputAmount), Cl.stringAscii("fastest")],
      user1
    );

    const { result } = simnet.callPublicFn(
      CONTRACT_NAME,
      "reclaim-escrow",
      [],
      user1
    );

    expect(result).toBeOk(Cl.bool(true));
  });

  it("tracks escrow and liquidity separately", () => {
    const inputAmount = 3_000_000;
    const minOutputAmount = 110_000_000;
    const liquidityAmount = 120_000_000;

    simnet.callPublicFn(
      CONTRACT_NAME,
      "provide-sbtc-liquidity",
      [Cl.uint(liquidityAmount)],
      deployer
    );

    simnet.callPublicFn(
      CONTRACT_NAME,
      "lock-stx-for-sbtc",
      [Cl.uint(inputAmount), Cl.uint(minOutputAmount), Cl.stringAscii("fastest")],
      user1
    );

    const accounting = simnet.callReadOnlyFn(
      CONTRACT_NAME,
      "get-accounting",
      [],
      deployer
    );

    expect(accounting.result).toEqual(
      Cl.tuple({
        "escrowed-sbtc": Cl.uint(0),
        "escrowed-stx": Cl.uint(inputAmount),
        "liquidity-sbtc": Cl.uint(liquidityAmount),
        "liquidity-stx": Cl.uint(0),
      })
    );
  });
});
