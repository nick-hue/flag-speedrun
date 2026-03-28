import { useEffect, useRef, useState } from 'react'
import { Play, RotateCcw } from 'lucide-react'
import countries from "./data/countries";
import './App.css'

const ROUND_OPTIONS = [5, 10, 20, 50, 100, 150];

function App() {
  const countryCodes = countries.map(c => c.code);
  const totalCountryCount = countryCodes.length;

  const [flags, setFlags] = useState([]);
  const [randomFlag, setRandomFlag] = useState(null);
  const [targetQueue, setTargetQueue] = useState([]);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [selectedRounds, setSelectedRounds] = useState(20);
  const [completedRounds, setCompletedRounds] = useState(0);
  const [elapsedCentiseconds, setElapsedCentiseconds] = useState(0);
  const activeGameRef = useRef(null);

  useEffect(() => {
    if (!hasStarted) {
      return undefined;
    }

    const timerId = window.setInterval(() => {
      setElapsedCentiseconds((currentCentiseconds) => currentCentiseconds + 1);
    }, 10);

    return () => window.clearInterval(timerId);
  }, [hasStarted]);

  useEffect(() => {
    if (!hasStarted || !randomFlag) {
      return;
    }

    activeGameRef.current?.scrollIntoView({
      behavior: 'instant',
      block: 'center',
    });
  }, [hasStarted, randomFlag]);

  function startGame() {
    // selects the correct [selectedRounds] (amount) flags for this session
    const nextTargetQueue = getRandomFlags(countryCodes, selectedRounds);

    setTargetQueue(nextTargetQueue);
    setNextRound(nextTargetQueue[0]);
    setCorrectAnswers(0);
    setCompletedRounds(0);
    setIsFinished(false);
    setElapsedCentiseconds(0);
    setHasStarted(true);
  }

  function resetGame() {
    setHasStarted(false);
    setIsFinished(false);
    setTargetQueue([]);
    setCorrectAnswers(0);
    setCompletedRounds(0);
    setElapsedCentiseconds(0);
    setFlags([]);
    setRandomFlag(null);
  }

  function setNextRound(targetFlag) {
    const nextFlags = getRoundFlags(countryCodes, targetFlag, 4);

    setFlags(nextFlags);
    setRandomFlag(targetFlag);
  }

  function handleFlagPick(country) {
    if (!hasStarted) {
      return;
    }

    const nextCompletedRounds = completedRounds + 1;
    const isCorrectPick = country === randomFlag;

    if (isCorrectPick) {
      setCorrectAnswers((currentCorrectAnswers) => currentCorrectAnswers + 1);
    }

    setCompletedRounds(nextCompletedRounds);

    if (nextCompletedRounds >= selectedRounds) {
      // game ended
      setHasStarted(false);
      setIsFinished(true);
      setFlags([]);
      setRandomFlag(null);
      return;
    }

    setNextRound(targetQueue[nextCompletedRounds]);
  }

  return (
    <>
      <section id="center">
        <div className="gameHeader">
          <h1>Flag Speedrun</h1>
        </div>

        <div className="gameControls">

          <button
            className="controlButton"
            disabled={hasStarted}
            onClick={startGame}>
            <Play className="controlIcon" aria-hidden="true" />
            Start
          </button>

          <label className="roundSelectGroup">
            <select
              className="roundSelect"
              value={selectedRounds}
              disabled={hasStarted}
              onChange={(event) => setSelectedRounds(Number(event.target.value))}
            >
              {ROUND_OPTIONS.map((roundCount) => (
                <option key={roundCount} value={roundCount}>
                  {roundCount}
                </option>
              ))}
              <option value={totalCountryCount}>{totalCountryCount} (All Countries)</option>
            </select>
          </label>

          <button
            className="controlButton"
            onClick={resetGame}>
            <RotateCcw className="controlIcon" aria-hidden="true" />
            Reset
          </button>
        </div>

        {hasStarted && (
          <div className="gameStatus">
            <h2 className="timer">Time: {formatTime(elapsedCentiseconds)}</h2>
            <p className="progress">{completedRounds} / {selectedRounds}</p>
          </div>
        )}

        {hasStarted && randomFlag && (
          <div className="activeGame" ref={activeGameRef}>
            <div className="targetCard">
              <h3 className="targetCountry">{getCountryName(randomFlag, countries)}</h3>
            </div>

            <div className="flags">
              {flags.map((code) => (
                <FlagButton key={code} country={code} onPick={handleFlagPick} />
              ))}
            </div>
          </div>
        )}

        {isFinished && (
          <>
            <div className="targetCard targetCardFinished">
              <h3 className="targetCountry">Finished in {formatTime(elapsedCentiseconds)}</h3>
              <p className="targetSummary">Final score: {correctAnswers} / {selectedRounds}</p>
            </div>

            <button className="controlButton">Submit Score</button>
          </>
        )}
      </section>

    </>
  )
}

function FlagImage({ country }) {
  return (
    <img
      className="flagImage"
      src={`https://flagsapi.com/${country}/flat/64.png`}
      alt={country}
    />
  );
}

function FlagButton({ country, onPick }) {
  return (
    <button className="flagButton" onClick={() => onPick(country)}>
      <FlagImage country={country} />
    </button>
  );
}

function getRandomFlags(list, count = 4) {
  const copy = [...list];

  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  const result = copy.slice(0, count);

  return result;
}

function getRoundFlags(list, targetFlag, count = 4) {
  const distractors = getRandomFlags(
    list.filter((code) => code !== targetFlag),
    count - 1,
  );

  return getRandomFlags([targetFlag, ...distractors], count);
}

function getCountryName(code, countryList) {
  const country = countryList.find((entry) => entry.code === code);

  return country ? country.name : code;
}

function formatTime(totalCentiseconds) {
  const minutes = String(Math.floor(totalCentiseconds / 6000)).padStart(2, '0');
  const seconds = String(Math.floor((totalCentiseconds % 6000) / 100)).padStart(2, '0');
  const centiseconds = String(totalCentiseconds % 100).padStart(2, '0');

  return `${minutes}:${seconds}.${centiseconds}`;
}

export default App
