import { useState } from 'react'
import { HomeLeagueArt } from './HomeLeagueArt'
import './courses.css'

const nearby = [
  ['Trigonometric Functions', 'Trigonometric_Functions-xayhLE.png'],
  ['Vectors', 'Vectors-43nO1R.png'],
  ['Fractions', 'Arithmetic_Thinking-KaQBTB.png'],
  ['Linear Systems', 'Linear_Systems-dEvpsN.png'],
  ['Coordinate Plane', 'Coordinate_Plane-TjmV5y.png'],
]

export function HomePage() {
  const [notice, setNotice] = useState('')
  return <main className="home-page">
    <div className="home-layout">
      <section className="home-summary" aria-label="Your activity">
        <h1>Welcome, Tjae!</h1>
        <div className="home-activity">
          <div className="home-streak-count">0 <span className="icon icon-lightning" aria-hidden="true" /></div>
          <div className="home-league-copy">
            <HomeLeagueArt />
            <div className="home-league-text"><h2>Ready to bounce back?</h2>
              <p>You previously finished #19 and kept your spot in the Hydrogen League</p>
            </div>
          </div>
          <button className="home-league-continue" type="button"
            onClick={() => setNotice('Leagues are not available in this preview.')}>Continue</button>
        </div>
      </section>
      <section className="home-course" aria-label="Recommended course">
        <div className="home-course-rail">
          {nearby.map(([title, image]) => <button key={title} type="button" className={title === 'Fractions' ? 'current' : ''}
            aria-label={title} onClick={() => setNotice(`${title} is not available in this preview.`)}>
            <img src={`/assets/courses/${image}`} alt="" />
          </button>)}
        </div>
        <div className="home-course-title"><h2>Fractions</h2><span>Level 1</span></div>
        <div className="home-course-actions">
          <div className="home-course-steps">
            <button type="button" onClick={() => setNotice('Warm Up practice is not available in this preview.')}>
              <img src="/assets/courses/warm-up.svg" alt="" /><strong>Warm Up</strong><i aria-hidden="true" />
            </button>
            <button type="button" onClick={() => setNotice('Splitting Parts is not available in this preview.')}>
              <img src="/assets/courses/node-upcoming.svg" alt="" /><span>Splitting Parts</span><i aria-hidden="true" />
            </button>
          </div>
          <button className="course-button" type="button"
            onClick={() => setNotice('Warm Up practice is not available in this preview. Browse Topics to open Writing Programs.')}>
            Start
          </button>
        </div>
      </section>
      <button className="home-tutor" type="button" onClick={() => setNotice('Tutor help is not available in this preview.')}>
        What do you need help with?
      </button>
    </div>
    {notice && <div className="course-notice" role="status">{notice}
      <button type="button" aria-label="Dismiss message" onClick={() => setNotice('')}>×</button>
    </div>}
  </main>
}
