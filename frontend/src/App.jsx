import { useEffect, useRef, useState } from 'react'
import { Play, RotateCcw, Trophy } from 'lucide-react'
import countries from './data/countries'
import './App.css'

const ROUND_OPTIONS = [5, 10, 20, 50, 100, 150]
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

function App() {
  const countryCodes = countries.map((country) => country.code)
  const totalCountryCount = countryCodes.length

  const [flags, setFlags] = useState([])
  const [randomFlag, setRandomFlag] = useState(null)
  const [targetQueue, setTargetQueue] = useState([])
  const [correctAnswers, setCorrectAnswers] = useState(0)
  const [hasStarted, setHasStarted] = useState(false)
  const [isFinished, setIsFinished] = useState(false)
  const [selectedRounds, setSelectedRounds] = useState(20)
  const [completedRounds, setCompletedRounds] = useState(0)
  const [elapsedCentiseconds, setElapsedCentiseconds] = useState(0)
  const [completedRun, setCompletedRun] = useState(null)
  const [activeSessionId, setActiveSessionId] = useState(null)
  const [username, setUsername] = useState('')
  const [submitState, setSubmitState] = useState('idle')
  const [submitMessage, setSubmitMessage] = useState('')
  const [submittedEntryId, setSubmittedEntryId] = useState(null)
  const [leaderboardEntries, setLeaderboardEntries] = useState([])
  const [leaderboardState, setLeaderboardState] = useState('idle')
  const [leaderboardMessage, setLeaderboardMessage] = useState('')
  const activeGameRef = useRef(null)

  useEffect(() => {
    if (!hasStarted) {
      return undefined
    }

    const timerId = window.setInterval(() => {
      setElapsedCentiseconds((currentCentiseconds) => currentCentiseconds + 1)
    }, 10)

    return () => window.clearInterval(timerId)
  }, [hasStarted])

  useEffect(() => {
    if (!hasStarted || !randomFlag) {
      return
    }

    activeGameRef.current?.scrollIntoView({
      behavior: 'instant',
      block: 'center',
    })
  }, [hasStarted, randomFlag])

  useEffect(() => {
    void loadLeaderboard(selectedRounds)
  }, [selectedRounds])

  async function startGame() {
    setSubmitState('idle')
    setSubmitMessage('')

    try {
      const response = await fetch(`${API_BASE_URL}/api/sessions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rounds: selectedRounds,
        }),
      })

      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload.error || 'Could not start a new game.')
      }

      const nextTargetQueue = getRandomFlags(countryCodes, selectedRounds)

      setActiveSessionId(payload.session.id)
      setTargetQueue(nextTargetQueue)
      setNextRound(nextTargetQueue[0])
      setCorrectAnswers(0)
      setCompletedRounds(0)
      setIsFinished(false)
      setElapsedCentiseconds(0)
      setCompletedRun(null)
      setSubmittedEntryId(null)
      setHasStarted(true)
    } catch (error) {
      setSubmitState('error')
      setSubmitMessage(error.message || 'Could not start a new game.')
    }
  }

  function resetGame() {
    setHasStarted(false)
    setIsFinished(false)
    setTargetQueue([])
    setCorrectAnswers(0)
    setCompletedRounds(0)
    setElapsedCentiseconds(0)
    setFlags([])
    setRandomFlag(null)
    setCompletedRun(null)
    setActiveSessionId(null)
    setSubmitState('idle')
    setSubmitMessage('')
    setSubmittedEntryId(null)
  }

  function setNextRound(targetFlag) {
    const nextFlags = getRoundFlags(countryCodes, targetFlag, 4)

    setFlags(nextFlags)
    setRandomFlag(targetFlag)
  }

  function handleFlagPick(country) {
    if (!hasStarted) {
      return
    }

    const nextCompletedRounds = completedRounds + 1
    const isCorrectPick = country === randomFlag

    if (isCorrectPick) {
      setCorrectAnswers((currentCorrectAnswers) => currentCorrectAnswers + 1)
    }

    setCompletedRounds(nextCompletedRounds)

    if (nextCompletedRounds >= selectedRounds) {
      const finalCorrectAnswers = isCorrectPick ? correctAnswers + 1 : correctAnswers

      setHasStarted(false)
      setIsFinished(true)
      setFlags([])
      setRandomFlag(null)
      setCompletedRun({
        rounds: selectedRounds,
        timeCentiseconds: elapsedCentiseconds,
        correctAnswers: finalCorrectAnswers,
      })
      return
    }

    setNextRound(targetQueue[nextCompletedRounds])
  }

  async function handleScoreSubmit() {
    if (!isFinished || !completedRun || !activeSessionId || submitState === 'submitting' || submittedEntryId) {
      return
    }

    const trimmedUsername = username.trim()

    if (!trimmedUsername) {
      setSubmitState('error')
      setSubmitMessage('Add a username before submitting your score.')
      return
    }

    setSubmitState('submitting')
    setSubmitMessage('')

    try {
      const response = await fetch(`${API_BASE_URL}/api/leaderboard`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: activeSessionId,
          username: trimmedUsername,
          correctAnswers: completedRun.correctAnswers,
        }),
      })

      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload.error || 'Could not submit your score.')
      }

      setSubmitState('success')
      setSubmitMessage('Score submitted. You are on the board.')
      setSubmittedEntryId(payload.entry.id)
      setCompletedRun({
        rounds: payload.entry.rounds,
        timeCentiseconds: payload.entry.timeCentiseconds,
        correctAnswers: payload.entry.correctAnswers,
      })
      setActiveSessionId(null)
      await loadLeaderboard(completedRun.rounds)
    } catch (error) {
      setSubmitState('error')
      setSubmitMessage(error.message || 'Could not submit your score.')
    }
  }

  async function loadLeaderboard(roundCount) {
    setLeaderboardState('loading')
    setLeaderboardMessage('')

    try {
      const response = await fetch(`${API_BASE_URL}/api/leaderboard?rounds=${roundCount}&limit=5`)
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload.error || 'Could not load leaderboard.')
      }

      setLeaderboardEntries(payload.entries)
      setLeaderboardState('success')
    } catch (error) {
      setLeaderboardState('error')
      setLeaderboardMessage(error.message || 'Could not load leaderboard.')
    }
  }

  return (
    <section id="center">
      <div className="gameHeader">
        <h1>Flag Speedrun</h1>
      </div>

      <div className="gameControls">
        <button className="controlButton" disabled={hasStarted} onClick={startGame}>
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

        <button className="controlButton" onClick={resetGame}>
          <RotateCcw className="controlIcon" aria-hidden="true" />
          Reset
        </button>
      </div>

      {!hasStarted && !isFinished && submitMessage && submitState === 'error' && (
        <p className="submitMessage submitMessageError">{submitMessage}</p>
      )}

      {hasStarted && (
        <div className="gameStatus">
          <h2 className="timer">Time: {formatTime(elapsedCentiseconds)}</h2>
          <p className="progress">
            {completedRounds} / {selectedRounds}
          </p>
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

      {isFinished && completedRun && (
        <div className="finishedPanel">
          <div className="targetCard targetCardFinished">
            <h3 className="targetCountry">Finished in {formatTime(completedRun.timeCentiseconds)}</h3>
            <p className="targetSummary">
              Final score: {completedRun.correctAnswers} / {completedRun.rounds}
            </p>
          </div>

          <div className="submitCard">
            <label className="submitLabel" htmlFor="username">
              Leaderboard username
            </label>
            <div className="submitRow">
              <input
                id="username"
                className="usernameInput"
                maxLength={24}
                placeholder="Enter your name"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
              />
              <button
                className="controlButton"
                disabled={
                  submitState === 'submitting' || Boolean(submittedEntryId) || !activeSessionId
                }
                onClick={handleScoreSubmit}
              >
                Submit Score
              </button>
            </div>
            {submitMessage && (
              <p className={`submitMessage submitMessage${capitalize(submitState)}`}>{submitMessage}</p>
            )}
          </div>
        </div>
      )}

      <section className="leaderboardPanel" aria-labelledby="leaderboard-title">
        <div className="leaderboardHeader">
          <div>
            <p className="leaderboardEyebrow">Leaderboard</p>
            <h2 id="leaderboard-title">{selectedRounds}-Round Top 5</h2>
          </div>
          <Trophy className="leaderboardIcon" aria-hidden="true" />
        </div>

        {leaderboardState === 'loading' && <p className="leaderboardMessage">Loading leaderboard...</p>}
        {leaderboardState === 'error' && <p className="leaderboardMessage">{leaderboardMessage}</p>}
        {leaderboardState === 'success' && leaderboardEntries.length === 0 && (
          <p className="leaderboardMessage">No scores yet for this round count. Be the first one on the board.</p>
        )}

        {leaderboardEntries.length > 0 && (
          <div className="leaderboardList" role="list">
            {leaderboardEntries.map((entry, index) => (
              <article
                key={entry.id}
                className={`leaderboardEntry${entry.id === submittedEntryId ? ' leaderboardEntryHighlight' : ''}`}
                role="listitem"
              >
                <p className="leaderboardRank">#{index + 1}</p>
                <div className="leaderboardEntryBody">
                  <p className="leaderboardName">{entry.username}</p>
                  <p className="leaderboardMeta">
                    {entry.correctAnswers}/{entry.rounds} correct
                  </p>
                </div>
                <p className="leaderboardTime">{formatTime(entry.timeCentiseconds)}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  )
}

function FlagImage({ country }) {
  return (
    <img
      className="flagImage"
      src={`https://flagsapi.com/${country}/flat/64.png`}
      alt={country}
    />
  )
}

function FlagButton({ country, onPick }) {
  return (
    <button className="flagButton" onClick={() => onPick(country)}>
      <FlagImage country={country} />
    </button>
  )
}

function getRandomFlags(list, count = 4) {
  const copy = [...list]

  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }

  return copy.slice(0, count)
}

function getRoundFlags(list, targetFlag, count = 4) {
  const distractors = getRandomFlags(
    list.filter((code) => code !== targetFlag),
    count - 1,
  )

  return getRandomFlags([targetFlag, ...distractors], count)
}

function getCountryName(code, countryList) {
  const country = countryList.find((entry) => entry.code === code)

  return country ? country.name : code
}

function formatTime(totalCentiseconds) {
  const minutes = String(Math.floor(totalCentiseconds / 6000)).padStart(2, '0')
  const seconds = String(Math.floor((totalCentiseconds % 6000) / 100)).padStart(2, '0')
  const centiseconds = String(totalCentiseconds % 100).padStart(2, '0')

  return `${minutes}:${seconds}.${centiseconds}`
}

function capitalize(value) {
  if (!value || value === 'idle') {
    return ''
  }

  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`
}

export default App
