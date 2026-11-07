import { useCallback, useEffect, useMemo, useState } from "react";
import { CuttableShape } from "./components/CuttableShape";
import { SplitLogo } from "./components/SplitLogo";
import { DailyResults } from "./components/DailyResults";
import { useDailyPuzzle } from "./hooks/useDailyPuzzle";
import { DAILY_LEVELS } from "./lib/dailyShapes";
import { getDailyPalettes, paletteStyle } from "./lib/dailyColors";
import { createProgress, isDayComplete, loadProgress, resolveActiveDate, saveProgress, watchProgress } from "./lib/progress";
import type { DailyProgress } from "./lib/progress";

export default function App() {
    const { date: today } = useDailyPuzzle();
    const [date, setDate] = useState(() => resolveActiveDate(today));
    return <DailyGame key={date} date={date} today={today} onStartToday={() => {
        setDate(today);
        window.scrollTo({ top: 0, behavior: "instant" });
    }} />;
}

function DailyGame({ date, today, onStartToday }: { date: string; today: string; onStartToday: () => void }) {
    const [progress, setProgress] = useState(() => loadProgress(date) ?? createProgress(date));
    const { id, level, cuts } = progress;
    const [showResults, setShowResults] = useState(() => isDayComplete(progress));
    const [saveFailed, setSaveFailed] = useState(false);
    const attemptId = `${id}:${level}`;
    const [readyAttempt, setReadyAttempt] = useState<string | null>(() => cuts[level] ? attemptId : null);
    const resultsReady = readyAttempt === attemptId;
    const onResultsComplete = useCallback(
        () => setReadyAttempt(attemptId),
        [attemptId],
    );
    const points = progress.shapes[level];
    const palettes = useMemo(() => getDailyPalettes(date), [date]);
    const commit = (next: DailyProgress) => {
        const result = saveProgress(next);
        setSaveFailed(!result.saved);
        setProgress(result.progress);
    };
    useEffect(() => watchProgress(date, (incoming) => {
        setProgress(incoming);
        setReadyAttempt(incoming.cuts[incoming.level] ? `${incoming.id}:${incoming.level}` : null);
        if (isDayComplete(incoming)) setShowResults(true);
    }), [date]);
    return (
        <div className={showResults ? "app" : "app is-playing"}>
            <header>
                <a className="wordmark" href="/" aria-label="fiddyfiddy home">
                    <SplitLogo />
                </a>
                <time dateTime={date}>{date}</time>
            </header>
            <main className={showResults ? "results-page" : "game-page"}
                style={showResults ? undefined : paletteStyle(palettes[level])}>
                {showResults ? (
                    <DailyResults
                        date={date}
                        submissions={cuts.map((cut) => cut!)}
                    />
                ) : (
                    <>
                        <h1 className="sr-only">Split the shape</h1>
                        <p className="game-intro">
                            Split the shape into two equal areas.
                        </p>
                        <div className="daily-level">
                            <div className="level-heading">
                                <strong>Level {level + 1}</strong>
                                <span>{level + 1} / 5</span>
                            </div>
                            <div
                                className="level-progress"
                                role="img"
                                aria-label={`Level ${level + 1} of 5`}
                            >
                                {DAILY_LEVELS.map((entry, index) => (
                                    <span
                                        key={entry.name}
                                        className={
                                            index < level
                                                ? "is-complete"
                                                : index === level
                                                  ? "is-current"
                                                  : ""
                                        }
                                    />
                                ))}
                            </div>
                        </div>
                        <CuttableShape
                            key={attemptId}
                            points={points}
                            submittedCut={cuts[level]}
                            resultsReady={resultsReady}
                            lastLevel={level === DAILY_LEVELS.length - 1}
                            onResultsComplete={onResultsComplete}
                            onNextLevel={() => {
                                if (!resultsReady) return;
                                if (level < DAILY_LEVELS.length - 1)
                                    commit({ ...progress, level: level + 1 });
                                else if (isDayComplete(progress))
                                    setShowResults(true);
                            }}
                            onSubmit={(cut) => {
                                if (cuts[level]) return;
                                commit({ ...progress, cuts: cuts.map((existing, index) => index === level ? cut : existing) });
                            }}
                        />
                    </>
                )}
            </main>
            {date !== today && (
                <aside className="new-day-notice">
                    <p>{showResults || !cuts.some(Boolean) ? "Today's puzzles are available." : "Finish this set to play today's puzzles."}</p>
                    {(showResults || !cuts.some(Boolean)) && <button type="button" onClick={onStartToday}>Play today's set</button>}
                </aside>
            )}
            {saveFailed && <p className="save-notice" role="status">Progress could not be saved in this browser.</p>}
            <footer>made by <a href="https://arons0n.com">arons0n</a></footer>
        </div>
    );
}
