import { useEffect, useState } from 'react'
import countries from "./data/countries";
import './App.css'

function App() {
  const countryCodes = countries.map(c => c.code);

  const [flags, setFlags] = useState([]);
  const [randomFlag, setRandomFlag] = useState(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [elapsedCentiseconds, setElapsedCentiseconds] = useState(0);

  useEffect(() => {
    if (!hasStarted) {
      return undefined;
    }

    const timerId = window.setInterval(() => {
      setElapsedCentiseconds((currentCentiseconds) => currentCentiseconds + 1);
    }, 10);

    return () => window.clearInterval(timerId);
  }, [hasStarted]);

  function startGame() {
    const nextFlags = getRandomFlags(countryCodes, 4);
    const targetFlag = getRandomItem(nextFlags);

    setFlags(nextFlags);
    setRandomFlag(targetFlag);

    setElapsedCentiseconds(0);
    setHasStarted(true);
  }

  function resetGame() {
    setHasStarted(false);
    setElapsedCentiseconds(0);
    setFlags(getRandomFlags(countryCodes, 4));
    setRandomFlag(null);
  }

  return (
    <>
      <section id="center">
        <div>
          <h1>Flag Speedrun</h1>
          <h2 className="timer">Time: {formatTime(elapsedCentiseconds)}</h2>
          {hasStarted && <h3>{getCountryName(randomFlag, countries)}</h3>}
          {!hasStarted && <p>Press Start</p>}
        </div>

        <div className="gameControls">
          <button
            className="controlButton"
            disabled={hasStarted}
            onClick={startGame}>
            Start
          </button>

          <button
            className="controlButton"
            onClick={resetGame}>
            Reset
          </button>
        </div>

        {hasStarted && (
          <div className="flags">
            {flags.map((code) => (
              <FlagButton key={code} country={code} />
            ))}
          </div>
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

function FlagButton({ country }) {
  return (
    <button className="flagButton" onClick={() => console.log({country})}>
      <FlagImage country={country} />
    </button>
  );
}

function getRandomItem(list) {
  const randomIndex = Math.floor(Math.random() * list.length);
  return list[randomIndex];
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
