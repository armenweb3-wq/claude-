import test from "node:test";
import assert from "node:assert/strict";
import { legResult, betResult, arb, targetStake, compound } from "../lib/engine.mjs";

const ft = (h, a) => ({ status: "FINISHED", home: "Spain", away: "Saudi Arabia", homeScore: h, awayScore: a });

test("over/under goals", () => {
  assert.equal(legResult({ type: "over_goals", line: 2.5 }, ft(3, 1)), true);
  assert.equal(legResult({ type: "over_goals", line: 2.5 }, ft(1, 1)), false);
  assert.equal(legResult({ type: "under_goals", line: 3.5 }, ft(1, 1)), true);
});

test("btts", () => {
  assert.equal(legResult({ type: "btts" }, ft(1, 1)), true);
  assert.equal(legResult({ type: "btts" }, ft(2, 0)), false);
});

test("team_win + double_chance", () => {
  assert.equal(legResult({ type: "team_win", team: "Spain" }, ft(2, 1)), true);
  assert.equal(legResult({ type: "team_win", team: "Spain" }, ft(0, 1)), false);
  assert.equal(legResult({ type: "double_chance", team: "Spain" }, ft(1, 1)), true);
  assert.equal(legResult({ type: "double_chance", team: "Saudi Arabia" }, ft(2, 0)), false);
});

test("manual markets and unfinished games stay undecided", () => {
  assert.equal(legResult({ type: "corners", manual: true }, ft(3, 0)), null);
  assert.equal(legResult({ type: "over_goals", line: 1.5 }, { status: "TIMED", homeScore: null, awayScore: null }), null);
});

test("combo bet (all must win)", () => {
  const combo = [{ type: "team_win", team: "Spain" }, { type: "over_goals", line: 2.5 }];
  assert.equal(betResult(combo, ft(3, 1)), "won");
  assert.equal(betResult(combo, ft(2, 0)), "lost"); // win but only 2 goals -> over 2.5 fails
  assert.equal(betResult(combo, { status: "TIMED", homeScore: null, awayScore: null }), null);
});

test("arbitrage detection + split", () => {
  const a = arb([2.10, 2.10], 100);
  assert.equal(a.isArb, true);
  assert.ok(Math.abs(a.stakes[0] - 50) < 0.01);
  assert.ok(Math.abs(a.ret - 105) < 0.6);
  assert.ok(a.profit > 4);
  const b = arb([1.9, 1.9], 100);
  assert.equal(b.isArb, false);
  assert.ok(b.profit < 0);
});

test("target-profit stake", () => {
  const s = targetStake([2.10, 2.05], 20);
  assert.ok(s > 500 && s < 560);
  assert.equal(targetStake([1.9, 1.9], 20), null); // impossible, no arb
});

test("compounding", () => {
  assert.equal(compound(500, [{ odds: 1.45, result: "won" }, { odds: 1.45, result: "won" }]), 1051.25);
  assert.equal(compound(500, [{ odds: 1.45, result: "won" }, { odds: 1.4, result: "lost" }]), 0);
});
