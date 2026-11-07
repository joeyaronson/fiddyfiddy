import { measureCut } from "./cut";
import type { SubmittedCut } from "./cut";

export const CUT_RATINGS = [
    { maximumError: 0, emoji: "🎯", name: "Bullseye" },
    { maximumError: 0.5, emoji: "💎", name: "Excellent" },
    { maximumError: 2, emoji: "🟢", name: "Close" },
    { maximumError: 5, emoji: "🟡", name: "Getting there" },
    { maximumError: 10, emoji: "🟠", name: "Off balance" },
    { maximumError: 50, emoji: "🔴", name: "Big split" },
] as const;

export const SCORE_EXPONENT = 10;

export function scoreCut(cut: SubmittedCut) {
    // Score the displayed percentages so the visible split and points agree.
    const smaller = Math.min(
        ...measureCut(cut).map(({ percentage }) => percentage),
    );
    const error = Math.round((50 - smaller) * 10) / 10;
    const points = Math.round(1000 * (smaller / 50) ** SCORE_EXPONENT);
    const rating = CUT_RATINGS.find(
        ({ maximumError }) => error <= maximumError,
    )!;
    return { points, error, ...rating };
}

export function shareResults(
    date: string,
    scores: ReturnType<typeof scoreCut>[],
): string {
    const total = scores.reduce((sum, score) => sum + score.points, 0);
    return [
        `fiddyfiddy · ${date}`,
        `${total.toLocaleString("en-US")} / 5,000`,
        "",
        scores.map((score) => score.emoji).join(""),
        "",
    ].join("\n");
}
