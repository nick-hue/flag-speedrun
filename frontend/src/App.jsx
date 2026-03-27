import { useState } from 'react'
// import countries from "i18n-iso-countries";
// import en from "i18n-iso-countries/langs/en.json";
// countries.registerLocale(en);
// const countryCodes = Object.keys(countries.getNames("en"));

import countries from "./data/countries";
import './App.css'

function App() {
  const countryCodes = countries.map(c => c.code);

  const [flags, setFlags] = useState(() => getRandomFlags(countryCodes, 4));
  const [hasStarted, setHasStarted] = useState(false);

  function getNewFlags() {
    setFlags(getRandomFlags(countryCodes, 4));
    setHasStarted(true);
  }

  return (
    <>
      <section id="center">
        <div>
          <h1>Flags</h1>
          <p>
            Press Start
          </p>
        </div>

        {hasStarted && (
          <div className="flags">
            {flags.map((code) => (
              <FlagButton key={code} country={code} />
            ))}
          </div>
        )}

        <button
          className="startGame" 
          onClick={getNewFlags}>
          Start
        </button>

      </section>

      <section id="spacer"></section>
    </>
  )
}

function FlagImage({ country }) {
  return (
    <img
      src={`https://flagsapi.com/${country}/flat/64.png`}
      alt={country}
    />
  );
}

function FlagButton({ country }) {
  return (
    <button onClick={() => console.log({country})}>
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

  return copy.slice(0, count);
}

export default App

