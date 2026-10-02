import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Sparkles, Stars, useGLTF } from '@react-three/drei';
import { BackSide, Box3, Vector3 } from 'three';
import {
  ArrowLeft,
  ArrowUpRight,
  Globe2,
  Images,
  LogOut,
  Orbit,
  Radio,
  Search,
  X,
} from 'lucide-react';
import JwstArchive from './JwstArchive.jsx';
import NasaEyes from './NasaEyes.jsx';

const SYSTEMS = [
  {
    id: 'k2-18-b',
    name: 'K2-18 b',
    catalog: 'K2-18',
    kind: 'EXOPLANET',
    distance: '124 ly',
    host: 'M3V · RED DWARF',
    radius: '2.37 R⊕',
    temperature: '265 K',
    signatures: ['H₂O', 'CH₄', 'CO₂'],
    position: [-4.2, 0.35, -1.2],
    scale: 0.96,
    color: '#54c7c1',
    phase: 0.5,
    series: [18, 20, 18, 22, 26, 23, 21, 29, 48, 84, 58, 34, 29, 31, 62, 92, 59, 33, 27, 31, 49, 72, 42, 24],
  },
  {
    id: 'trappist-1-e',
    name: 'TRAPPIST-1 e',
    catalog: 'TRAPPIST-1',
    kind: 'EXOPLANET',
    distance: '40.7 ly',
    host: 'M8V · ULTRACOOL DWARF',
    radius: '0.92 R⊕',
    temperature: '246 K',
    signatures: ['H₂O', 'CO₂', 'O₃'],
    position: [1.1, -0.35, 0.4],
    scale: 0.72,
    color: '#ec936c',
    phase: 2.4,
    series: [24, 26, 30, 28, 34, 48, 68, 52, 36, 31, 34, 45, 73, 96, 65, 41, 33, 37, 50, 70, 55, 37, 31, 27],
  },
  {
    id: 'wasp-39-b',
    name: 'WASP-39 b',
    catalog: 'WASP-39',
    kind: 'EXOPLANET',
    distance: '700 ly',
    host: 'G8V · YELLOW DWARF',
    radius: '1.27 R♃',
    temperature: '1,120 K',
    signatures: ['H₂O', 'CO₂', 'Na'],
    position: [4.0, 0.55, -2.0],
    scale: 1.2,
    color: '#e9b961',
    phase: 1.2,
    rings: true,
    series: [20, 24, 28, 34, 49, 77, 90, 62, 38, 30, 33, 47, 74, 93, 62, 44, 37, 41, 60, 82, 63, 42, 30, 24],
  },
  {
    id: 'eagle-nebula',
    name: 'Eagle Nebula',
    catalog: 'M16 · NGC 6611',
    kind: 'NEBULA',
    distance: '6,500 ly',
    host: 'OB ASSOCIATION',
    radius: '70 ly across',
    temperature: '10–20 K',
    signatures: ['H₂', 'O III', 'DUST'],
    position: [-0.5, 2.15, -3.5],
    scale: 1.12,
    color: '#81a5eb',
    phase: 3.7,
    series: [22, 35, 58, 74, 43, 31, 54, 86, 62, 39, 57, 89, 72, 46, 37, 61, 95, 76, 49, 42, 63, 82, 55, 30],
  },
  {
    id: 'deep-field',
    name: 'Hubble Deep Field',
    catalog: 'HDF-N · FIELD 01',
    kind: 'DEEP FIELD',
    distance: '12.8B ly lookback',
    host: 'EARLY GALAXY FIELD',
    radius: '3,000+ galaxies',
    temperature: 'z = 4–10',
    signatures: ['Hα', '[O III]', 'Lyα'],
    position: [2.2, -1.7, -4.0],
    scale: 0.86,
    color: '#dc8ea4',
    phase: 4.8,
    series: [26, 32, 49, 76, 58, 42, 62, 92, 66, 43, 55, 83, 70, 49, 60, 96, 74, 46, 39, 58, 79, 61, 44, 31],
  },
  {
    id: 'bennu',
    name: '1999 RQ36 (Bennu)',
    catalog: '101955 · OSIRIS-REx TARGET',
    kind: 'ASTEROID',
    distance: '1.13 AU orbital radius',
    host: 'APOLLO-GROUP NEAR-EARTH OBJECT',
    radius: '246 m mean radius',
    temperature: '~260 K estimated',
    signatures: ['CARBON-RICH', 'HYDRATED MINERALS', 'ORGANICS'],
    position: [-1.35, -2.65, -1.9],
    scale: 0.92,
    color: '#d6b27d',
    phase: 5.6,
    model: '/models/1999 RQ36 asteroid/1999 RQ36 asteroid.glb',
    series: [31, 35, 42, 38, 46, 54, 49, 43, 58, 64, 52, 47, 56, 69, 61, 52, 48, 59, 71, 62, 54, 49, 44, 39],
  },
];

function CelestialModel({ url }) {
  const { scene } = useGLTF(url);
  const normalizedScene = useMemo(() => {
    const clone = scene.clone(true);
    const bounds = new Box3().setFromObject(clone);
    const center = bounds.getCenter(new Vector3());
    const size = bounds.getSize(new Vector3());
    const largestDimension = Math.max(size.x, size.y, size.z);

    clone.position.sub(center);
    clone.scale.multiplyScalar(1.55 / largestDimension);
    return clone;
  }, [scene]);

  return <primitive object={normalizedScene} />;
}

function CelestialTarget({ system, onHover, onSelect, reducedMotion }) {
  const group = useRef();

  useFrame(({ clock }, delta) => {
    if (!group.current) return;
    group.current.position.y = system.position[1] + Math.sin(clock.elapsedTime * 0.24 + system.phase) * 0.09;
    if (!reducedMotion) group.current.rotation.y += delta * 0.08;
  });

  function handlePointerOver(event) {
    event.stopPropagation();
    onHover(system.id);
    document.body.style.cursor = 'pointer';
  }

  function handlePointerOut() {
    onHover(null);
    document.body.style.cursor = '';
  }

  function handleSelect(event) {
    event.stopPropagation();
    onSelect(system.id);
  }

  return (
    <group ref={group} position={system.position} scale={system.scale}>
      <mesh
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        onClick={handleSelect}
      >
        <sphereGeometry args={[system.model ? 1.65 : 0.74, 56, 56]} />
        {system.model ? (
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        ) : (
          <meshStandardMaterial
            color={system.color}
            emissive={system.color}
            emissiveIntensity={system.kind === 'NEBULA' ? 0.42 : 0.11}
            roughness={system.kind === 'NEBULA' ? 0.94 : 0.72}
            metalness={system.kind === 'EXOPLANET' ? 0.12 : 0.02}
          />
        )}
      </mesh>
      {system.model && (
        <Suspense fallback={null}>
          <CelestialModel url={system.model} />
        </Suspense>
      )}
      <mesh scale={1.12}>
        <sphereGeometry args={[0.74, 40, 40]} />
        <meshBasicMaterial
          color={system.color}
          side={BackSide}
          transparent
          opacity={system.kind === 'NEBULA' ? 0.2 : 0.075}
          depthWrite={false}
        />
      </mesh>
      {system.kind === 'DEEP FIELD' && (
        <group rotation={[0.7, 0.15, -0.2]}>
          <mesh rotation={[Math.PI / 2.7, 0, 0]}>
            <torusGeometry args={[1.02, 0.018, 6, 96]} />
            <meshBasicMaterial color={system.color} transparent opacity={0.72} />
          </mesh>
          <mesh rotation={[Math.PI / 2.5, 0.25, 0.18]}>
            <torusGeometry args={[1.3, 0.009, 5, 96]} />
            <meshBasicMaterial color="#f4c987" transparent opacity={0.52} />
          </mesh>
        </group>
      )}
      {system.rings && (
        <mesh rotation={[1.12, 0.12, 0.18]}>
          <torusGeometry args={[1.12, 0.035, 4, 100]} />
          <meshStandardMaterial color="#f3d6a4" metalness={0.52} roughness={0.46} />
        </mesh>
      )}
      <Sparkles
        count={system.kind === 'DEEP FIELD' ? 58 : system.kind === 'NEBULA' ? 34 : 12}
        color={system.color}
        opacity={0.68}
        scale={system.kind === 'DEEP FIELD' ? 3.3 : 2.2}
        size={system.kind === 'DEEP FIELD' ? 2 : 3}
        speed={reducedMotion ? 0 : 0.12}
      />
    </group>
  );
}

function CameraRig({ controls, focusedSystem, reducedMotion }) {
  const { camera } = useThree();
  const moving = useRef(false);
  const startedAt = useRef(0);
  const startPosition = useRef(new Vector3());
  const startTarget = useRef(new Vector3());
  const endPosition = useRef(new Vector3());
  const endTarget = useRef(new Vector3());
  const initialized = useRef(false);

  useEffect(() => {
    const orbit = controls.current;
    if (!orbit) return;
    if (!initialized.current && !focusedSystem) {
      initialized.current = true;
      return;
    }
    initialized.current = true;

    startPosition.current.copy(camera.position);
    startTarget.current.copy(orbit.target);
    const position = focusedSystem?.position ?? [0, 0, 0];
    endTarget.current.set(position[0], position[1], position[2]);
    endPosition.current.set(
      position[0],
      position[1] + 0.35,
      position[2] + (focusedSystem ? Math.max(3.8, focusedSystem.scale * 4.4) : 14),
    );
    startedAt.current = performance.now();
    moving.current = true;
    orbit.enabled = false;

    if (reducedMotion) {
      camera.position.copy(endPosition.current);
      orbit.target.copy(endTarget.current);
      orbit.enabled = true;
      moving.current = false;
      orbit.update();
    }
  }, [camera, controls, focusedSystem, reducedMotion]);

  useFrame(() => {
    const orbit = controls.current;
    if (!orbit || !moving.current) return;
    const progress = Math.min((performance.now() - startedAt.current) / 820, 1);
    const eased = progress * progress * (3 - 2 * progress);
    camera.position.lerpVectors(startPosition.current, endPosition.current, eased);
    orbit.target.lerpVectors(startTarget.current, endTarget.current, eased);
    orbit.update();
    if (progress === 1) {
      moving.current = false;
      orbit.enabled = true;
    }
  });

  return null;
}

function TargetField({ hoveredId, onHover, onSelect, focusedSystem, reducedMotion }) {
  const controls = useRef();

  return (
    <>
      <color attach="background" args={['#070b12']} />
      <fog attach="fog" args={['#070b12', 18, 42]} />
      <ambientLight intensity={0.78} />
      <pointLight position={[-7, 6, 8]} intensity={34} color="#b5d7ff" />
      <pointLight position={[6, -4, -5]} intensity={22} color="#f08c67" />
      <Stars radius={72} depth={42} count={1500} factor={2.2} saturation={0.1} fade speed={reducedMotion ? 0 : 0.12} />
      <Sparkles count={96} color="#9bc8f5" opacity={0.28} scale={[18, 10, 12]} size={1.6} speed={reducedMotion ? 0 : 0.08} />
      {SYSTEMS.map((system) => (
        <CelestialTarget
          key={system.id}
          system={system}
          active={hoveredId === system.id}
          onHover={onHover}
          onSelect={onSelect}
          reducedMotion={reducedMotion}
        />
      ))}
      <OrbitControls
        ref={controls}
        enablePan={false}
        enableDamping
        dampingFactor={0.055}
        minDistance={5}
        maxDistance={20}
        rotateSpeed={0.46}
        zoomSpeed={0.7}
        autoRotate={!focusedSystem && !reducedMotion}
        autoRotateSpeed={0.16}
      />
      <CameraRig controls={controls} focusedSystem={focusedSystem} reducedMotion={reducedMotion} />
    </>
  );
}

function TargetRow({ system, active, onHover, onSelect }) {
  return (
    <button
      className={`target-row${active ? ' target-row--active' : ''}`}
      type="button"
      aria-pressed={active}
      onMouseEnter={() => onHover(system.id)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(system.id)}
      onBlur={() => onHover(null)}
      onClick={() => onSelect(system.id)}
    >
      <span className="target-row__swatch" style={{ '--target-color': system.color }} />
      <span className="target-row__copy">
        <span>{system.name}</span>
        <small>{system.kind}</small>
      </span>
      <ArrowUpRight size={14} aria-hidden="true" />
    </button>
  );
}

function TargetPreview({ system, onFocus }) {
  return (
    <aside className="target-preview" aria-live="polite">
      <div className="preview-overline">
        <span className="live-dot" /> TARGET DETECTED
        <span className="preview-catalog">{system.catalog}</span>
      </div>
      <h2>{system.name}</h2>
      <p className="preview-kind">{system.kind}</p>
      <div className="preview-metrics">
        <div><span>DISTANCE</span><strong>{system.distance}</strong></div>
        <div><span>HOST / TYPE</span><strong>{system.host}</strong></div>
      </div>
      <div className="signature-line">
        <span>SPECTRAL MARKERS</span>
        <div className="signature-pills">
          {system.signatures.map((signature) => <span key={signature}>{signature}</span>)}
        </div>
      </div>
      <button className="preview-action" type="button" onClick={() => onFocus(system.id)}>
        OPEN SYSTEM <ArrowUpRight size={15} aria-hidden="true" />
      </button>
    </aside>
  );
}

function SpectrumChart({ system }) {
  const points = system.series.map((value, index) => {
    const x = 14 + (index * 292) / (system.series.length - 1);
    const y = 146 - value * 1.16;
    return `${x},${y}`;
  }).join(' ');
  const areaPoints = `14,150 ${points} 306,150`;

  return (
    <div className="spectrum-chart">
      <div className="chart-heading">
        <span>TRANSMISSION SPECTRUM</span>
        <span>0.4—5.0 μm</span>
      </div>
      <svg viewBox="0 0 320 170" role="img" aria-label={`Illustrative transmission spectrum for ${system.name}`}>
        <defs>
          <linearGradient id="spectrum-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={system.color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={system.color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[34, 68, 102, 136].map((y) => (
          <line key={y} x1="14" x2="306" y1={y} y2={y} className="chart-gridline" />
        ))}
        <polygon points={areaPoints} fill="url(#spectrum-fill)" />
        <polyline points={points} fill="none" stroke={system.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {system.series.map((value, index) => {
          if (value < 72) return null;
          const x = 14 + (index * 292) / (system.series.length - 1);
          const y = 146 - value * 1.16;
          return <circle key={index} cx={x} cy={y} r="3" fill="#f3f7ff" stroke={system.color} strokeWidth="2" />;
        })}
        <text x="14" y="164" className="chart-axis-label">0.5 μm</text>
        <text x="262" y="164" className="chart-axis-label">5.0 μm</text>
      </svg>
    </div>
  );
}

function SpectroscopyPanel({ system, onClose }) {
  return (
    <aside className="spectroscopy-panel">
      <div className="spectroscopy-topline">
        <button className="icon-button back-button" type="button" onClick={onClose} aria-label="Return to starfield" title="Return to starfield">
          <ArrowLeft size={17} aria-hidden="true" />
        </button>
        <div className="spectroscopy-status"><span className="live-dot" /> SPECTROSCOPY</div>
        <button className="icon-button close-button" type="button" onClick={onClose} aria-label="Close system details" title="Close details">
          <X size={17} aria-hidden="true" />
        </button>
      </div>
      <div className="spectroscopy-title">
        <p>{system.catalog} <span>/</span> {system.kind}</p>
        <h2>{system.name}</h2>
        <span className="system-distance">{system.distance} from Earth</span>
      </div>
      <div className="system-facts">
        <div><span>HOST STAR</span><strong>{system.host}</strong></div>
        <div><span>RADIUS</span><strong>{system.radius}</strong></div>
        <div><span>EST. TEMP</span><strong>{system.temperature}</strong></div>
      </div>
      <SpectrumChart system={system} />
      <div className="molecule-section">
        <div className="section-label">DETECTED SIGNATURES <span>03</span></div>
        <div className="molecule-list">
          {system.signatures.map((signature, index) => (
            <div className="molecule-row" key={signature}>
              <span className="molecule-index">0{index + 1}</span>
              <strong>{signature}</strong>
              <span className="molecule-detection">DETECTED</span>
              <span className="molecule-bar"><i style={{ width: `${82 - index * 13}%`, background: system.color }} /></span>
            </div>
          ))}
        </div>
      </div>
      <div className="observation-note">
        <Radio size={15} aria-hidden="true" />
        <span>Illustrative demo observation<br /><strong>JAMES WEBB SPACE TELESCOPE</strong></span>
      </div>
    </aside>
  );
}

function useReducedMotionPreference() {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setReducedMotion(preference.matches);
    updatePreference();
    preference.addEventListener('change', updatePreference);
    return () => preference.removeEventListener('change', updatePreference);
  }, []);

  return reducedMotion;
}

export default function Explorer({ onSignOut }) {
  const [hoveredId, setHoveredId] = useState(null);
  const [focusedId, setFocusedId] = useState(null);
  const [query, setQuery] = useState('');
  const [activeView, setActiveView] = useState('nasa-eyes');
  const archiveMode = activeView === 'archive';
  const nasaEyesMode = activeView === 'nasa-eyes';
  const reducedMotion = useReducedMotionPreference();
  const focusedSystem = SYSTEMS.find((system) => system.id === focusedId) ?? null;
  const hoveredSystem = SYSTEMS.find((system) => system.id === hoveredId) ?? null;
  const filteredSystems = SYSTEMS.filter((system) =>
    `${system.name} ${system.catalog} ${system.kind}`.toLowerCase().includes(query.toLowerCase()),
  );

  function focusSystem(id) {
    setFocusedId(id);
    setHoveredId(id);
  }

  function resetView() {
    setFocusedId(null);
    setHoveredId(null);
    setActiveView('nasa-eyes');
  }

  return (
    <main className="explorer-shell">
      <header className="explorer-topbar">
        <a className="explorer-brand" href="#observatory" aria-label="Space observatory home" onClick={resetView}>
          <span className="explorer-brand-mark"><Orbit size={17} aria-hidden="true" /></span>
          <span>space<span className="brand-suffix"> / observatory</span></span>
        </a>
        <div className="survey-status"><span className="live-dot" /> {archiveMode ? 'JWST DATA' : 'NASA INTERACTIVE'} <span className="status-divider">/</span> {archiveMode ? 'IMAGE ARCHIVE' : 'NASA EYES'}</div>
        <div className="topbar-actions">
          <button
            className="icon-button archive-toggle"
            type="button"
            onClick={() => {
              setActiveView('archive');
            }}
            aria-label="Browse JWST images"
            aria-pressed={archiveMode}
            title="Browse JWST images"
          >
            <Images size={17} aria-hidden="true" />
          </button>
          <button
            className="icon-button"
            type="button"
            onClick={() => {
              setActiveView('nasa-eyes');
            }}
            aria-label="Explore with NASA Eyes"
            aria-pressed={nasaEyesMode}
            title={nasaEyesMode ? 'Return to 3D targets' : 'Explore with NASA Eyes'}
          >
            <Globe2 size={17} aria-hidden="true" />
          </button>
          <button className="icon-button" type="button" onClick={onSignOut} aria-label="Return to sign in" title="Return to sign in">
            <LogOut size={17} aria-hidden="true" />
          </button>
        </div>
      </header>

      <section className={`space-stage${archiveMode ? ' space-stage--archive' : ' space-stage--nasa-eyes'}`} aria-label={archiveMode ? 'JWST image archive' : 'NASA Eyes interactive experiences'}>
        {archiveMode ? <JwstArchive /> : <NasaEyes />}
      </section>
    </main>
  );
}