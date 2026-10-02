import { useState } from 'react';
import { ExternalLink, Globe2, LoaderCircle } from 'lucide-react';

const DESTINATIONS = [
  { id: 'solar-system', label: 'Solar System', title: 'NASA Eyes on the Solar System', src: 'https://eyes.nasa.gov/apps/solar-system/#/home' },
  { id: 'earth', label: 'Earth', title: 'NASA Eyes on Earth', src: 'https://eyes.nasa.gov/apps/earth/#/' },
  { id: 'exoplanets', label: 'Exoplanets', title: 'NASA Eyes on Exoplanets', src: 'https://eyes.nasa.gov/apps/exo/#/' },
  { id: 'asteroids', label: 'Asteroids', title: 'NASA Eyes on Asteroids', src: 'https://eyes.nasa.gov/apps/asteroids/#/home' },
];

export function NasaEyesFrame({ src, title }) {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="nasa-eyes-frame">
      {!loaded && (
        <div className="nasa-eyes-loader" role="status" aria-live="polite">
          <LoaderCircle size={24} aria-hidden="true" />
          <span>Loading NASA Eyes…</span>
        </div>
      )}
      <iframe
        className="nasa-eyes-iframe"
        src={src}
        title={title}
        allow="fullscreen"
        allowFullScreen
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        onLoad={() => setLoaded(true)}
      />
    </div>
  );
}

export default function NasaEyes() {
  const [activeDestinationId, setActiveDestinationId] = useState(DESTINATIONS[0].id);
  const activeDestination = DESTINATIONS.find(({ id }) => id === activeDestinationId);

  return (
    <section className="nasa-eyes-view" aria-label="NASA Eyes interactive experiences">
      <header className="nasa-eyes-header">
        <div className="nasa-eyes-heading">
          <span className="nasa-eyes-mark"><Globe2 size={16} aria-hidden="true" /></span>
          <div>
            <p className="nasa-eyes-kicker">NASA INTERACTIVE</p>
            <h1>Eyes</h1>
          </div>
        </div>
        <nav className="nasa-eyes-destinations" aria-label="Choose a NASA Eyes experience">
          {DESTINATIONS.map(({ id, label }) => (
            <button
              key={id}
              className="nasa-eyes-destination"
              type="button"
              aria-pressed={id === activeDestinationId}
              onClick={() => setActiveDestinationId(id)}
            >
              {label}
            </button>
          ))}
        </nav>
        <a
          className="nasa-eyes-open"
          href={activeDestination.src}
          target="_blank"
          rel="noreferrer"
          aria-label={`Open ${activeDestination.title} in a new tab`}
          title="Open in a new tab"
        >
          <ExternalLink size={15} aria-hidden="true" />
        </a>
      </header>
      <NasaEyesFrame key={activeDestination.id} src={activeDestination.src} title={activeDestination.title} />
    </section>
  );
}