import { useEffect, useState } from 'react';
import { ArrowDownToLine, ChevronLeft, ChevronRight, ExternalLink, Image, LoaderCircle, RefreshCw, Search } from 'lucide-react';

const PER_PAGE = 12;

function getRecordList(payload) {
  const body = payload?.body ?? payload?.data ?? payload?.results ?? payload;
  if (Array.isArray(body)) return body;
  for (const key of ['data', 'results', 'files', 'observations', 'items']) {
    if (Array.isArray(body?.[key])) return body[key];
  }
  return [];
}

function mapRecord(record, index) {
  const fileName = record.fileName ?? record.filename ?? record.file_name ?? record.name ?? record.id ?? `JWST file ${index + 1}`;
  const previewUrl = record.thumbnail ?? record.dataURL ?? record.dataUrl ?? record.previewURL ?? record.previewUrl ?? record.jpegURL ?? record.url ?? record.location ?? '';
  const productUrl = record.location ?? previewUrl;
  const target = record.target ?? record.targetName ?? record.target_name ?? record.object ?? record.observation_id ?? 'JWST observation';
  const fileInstrument = String(fileName).match(/_(nrc|nis|nrs|mir|fgs)[a-z0-9]*_/i)?.[1]?.toLowerCase();
  const instrument = record.instrument ?? record.instrumentName ?? record.instrument_name ?? record.detector ?? ({
    nrc: 'NIRCam',
    nis: 'NIRISS',
    nrs: 'NIRSpec',
    mir: 'MIRI',
    fgs: 'FGS',
  }[fileInstrument] ?? 'JWST');
  const program = record.program ?? record.programId ?? record.program_id ?? record.programID ?? '';
  const fileType = record.fileType ?? record.filetype ?? record.file_type ?? String(fileName).split('.').at(-1) ?? 'FILE';

  return {
    id: String(record.observationId ?? record.observation_id ?? record.id ?? `${fileName}-${index}`),
    fileName: String(fileName),
    imageUrl: typeof previewUrl === 'string' ? previewUrl : '',
    productUrl: typeof productUrl === 'string' ? productUrl : '',
    target: String(target),
    instrument: String(instrument),
    program: String(program),
    fileType: String(fileType).toUpperCase(),
  };
}

function getTotalPages(payload) {
  const body = payload?.body ?? payload?.data ?? payload;
  const total = Number(body?.totalPages ?? body?.total_pages ?? body?.pages ?? payload?.totalPages);
  return Number.isFinite(total) && total > 0 ? total : null;
}

function getOptionList(payload, type) {
  const records = getRecordList(payload);
  return records.map((record) => {
    if (typeof record === 'string' || typeof record === 'number') return String(record);
    if (type === 'suffix') return String(record.suffix ?? record.name ?? record.value ?? '');
    return String(record.programId ?? record.programID ?? record.program_id ?? record.id ?? record.program ?? '');
  }).filter(Boolean);
}

export default function JwstArchive() {
  const [queryType, setQueryType] = useState('type');
  const [queryValue, setQueryValue] = useState('jpg');
  const [searchText, setSearchText] = useState('');
  const [page, setPage] = useState(1);
  const [records, setRecords] = useState([]);
  const [totalPages, setTotalPages] = useState(null);
  const [filterOptions, setFilterOptions] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  async function loadArchive(nextPage = 1, type = queryType, value = queryValue) {
    setStatus('loading');
    setError('');
    const params = new URLSearchParams({ page: String(nextPage), perPage: String(PER_PAGE) });
    if (value.trim()) params.set(type, value.trim());

    try {
      const response = await fetch(`/api/jwst/catalog?${params}`);
      let payload;
      try {
        payload = JSON.parse(await response.text());
      } catch {
        payload = null;
      }
      if (!response.ok) {
        throw new Error(payload?.error || `JWST API request failed (HTTP ${response.status}).`);
      }
      if (!payload) throw new Error('The JWST API returned an unreadable response.');

      setRecords(getRecordList(payload).map(mapRecord));
      setTotalPages(getTotalPages(payload));
      setPage(nextPage);
      setLastUpdated(new Date());
      setStatus('ready');
    } catch (requestError) {
      setRecords([]);
      setTotalPages(null);
      setError(requestError.message || 'Could not load JWST data.');
      setStatus('error');
    }
  }

  useEffect(() => {
    loadArchive();
  }, []);

  useEffect(() => {
    if (queryType !== 'suffix' && queryType !== 'programId') {
      setFilterOptions([]);
      return undefined;
    }

    let active = true;
    const endpoint = queryType === 'suffix' ? '/api/jwst/suffixes' : '/api/jwst/programs';
    fetch(endpoint)
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'Could not load filter options.');
        return payload;
      })
      .then((payload) => {
        if (active) setFilterOptions(getOptionList(payload, queryType));
      })
      .catch(() => {
        if (active) setFilterOptions([]);
      });

    return () => {
      active = false;
    };
  }, [queryType]);

  function submitQuery(event) {
    event.preventDefault();
    loadArchive(1);
  }

  function changeQueryType(event) {
    const nextType = event.target.value;
    setQueryType(nextType);
    setQueryValue(nextType === 'type' ? 'jpg' : '');
  }

  const visibleRecords = records.filter((record) =>
    `${record.fileName} ${record.target} ${record.instrument} ${record.program}`
      .toLowerCase()
      .includes(searchText.trim().toLowerCase()),
  );
  const hasNextPage = totalPages ? page < totalPages : records.length === PER_PAGE;
  const queryLabel = {
    type: 'File type',
    suffix: 'Product suffix',
    programId: 'Program ID',
    observationId: 'Observation ID',
  }[queryType];
  const queryPlaceholder = {
    type: 'jpg',
    suffix: '_cal',
    programId: '2734',
    observationId: 'jw02731002001_02107_00004_mirimage_o002',
  }[queryType];

  return (
    <section className="jwst-archive" aria-label="JWST image archive">
      <header className="archive-heading">
        <div>
          <p className="archive-eyebrow"><span className="live-dot" /> JAMES WEBB SPACE TELESCOPE</p>
          <h1>Image archive</h1>
          <p className="archive-description">Search calibrated observations and explore the latest public data.</p>
        </div>
        <button
          className="archive-refresh"
          type="button"
          onClick={() => loadArchive(page)}
          disabled={status === 'loading'}
          aria-label="Refresh archive results"
          title="Refresh results"
        >
          {status === 'loading' ? <LoaderCircle size={16} className="archive-spinner" /> : <RefreshCw size={16} />}
        </button>
      </header>

      <form className="archive-query" onSubmit={submitQuery}>
        <label className="archive-control">
          <span>SEARCH BY</span>
          <select value={queryType} onChange={changeQueryType}>
            <option value="type">File type</option>
            <option value="suffix">Product suffix</option>
            <option value="programId">Program ID</option>
            <option value="observationId">Observation ID</option>
          </select>
        </label>
        <label className="archive-control archive-control--value">
          <span>{queryLabel.toUpperCase()}</span>
          <input
            value={queryValue}
            onChange={(event) => setQueryValue(event.target.value)}
            placeholder={queryPlaceholder}
            maxLength={120}
            list={queryType === 'suffix' ? 'jwst-suffix-options' : queryType === 'programId' ? 'jwst-program-options' : undefined}
            required
          />
          {filterOptions.length > 0 && (
            <datalist id={queryType === 'suffix' ? 'jwst-suffix-options' : 'jwst-program-options'}>
              {filterOptions.map((option) => <option value={option} key={option} />)}
            </datalist>
          )}
        </label>
        <button className="archive-submit" type="submit" disabled={status === 'loading'}>
          <Search size={15} aria-hidden="true" /> Search archive
        </button>
        <label className="archive-filter">
          <Search size={14} aria-hidden="true" />
          <input
            type="search"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Filter this page"
            aria-label="Filter returned files"
          />
        </label>
      </form>

      <div className="archive-results-bar" aria-live="polite">
        <span>{status === 'loading' ? 'CONNECTING TO JWST ARCHIVE' : status === 'error' ? 'ARCHIVE UNAVAILABLE' : `${visibleRecords.length} FILES ON THIS PAGE`}</span>
        <span>{lastUpdated ? `UPDATED ${lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'LIVE API'}</span>
      </div>

      {status === 'loading' && (
        <div className="archive-state" role="status"><LoaderCircle size={20} className="archive-spinner" /> Loading JWST observations</div>
      )}
      {status === 'error' && (
        <div className="archive-state archive-state--error" role="alert">
          <p>{error}</p>
          {error.includes('.env.local') && <code>JWST_API_KEY=your_api_key</code>}
          <button className="archive-retry" type="button" onClick={() => loadArchive(page)}>Try again</button>
        </div>
      )}
      {status === 'ready' && visibleRecords.length === 0 && (
        <div className="archive-state"><Image size={20} /> No matching files on this page.</div>
      )}
      {status === 'ready' && visibleRecords.length > 0 && (
        <div className="archive-grid">
          {visibleRecords.map((record) => (
            <article className="archive-card" key={record.id}>
              <div className="archive-image-wrap">
                {record.imageUrl ? (
                  <a className="archive-image-link" href={record.imageUrl} target="_blank" rel="noreferrer" aria-label={`Open image ${record.fileName}`}>
                    <img src={record.imageUrl} alt={`${record.target}, observed by ${record.instrument}`} loading="lazy" />
                    <span className="archive-open"><ExternalLink size={14} aria-hidden="true" /></span>
                  </a>
                ) : (
                  <div className="archive-image-empty"><Image size={24} /><span>Preview unavailable</span></div>
                )}
              </div>
              <div className="archive-card-info">
                <span className="archive-card-kind">{record.instrument} <i /> {record.fileType}</span>
                <h2 title={record.target}>{record.target}</h2>
                <p title={record.fileName}>{record.fileName}</p>
                {record.program && <span className="archive-program">PROGRAM {record.program}</span>}
                {record.productUrl && (
                  <a className="archive-download" href={record.productUrl} target="_blank" rel="noreferrer" aria-label={`Open product ${record.fileName}`}>
                    <ArrowDownToLine size={14} aria-hidden="true" /> Open product
                  </a>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      <footer className="archive-pagination">
        <button type="button" onClick={() => loadArchive(page - 1)} disabled={page <= 1 || status === 'loading'}>
          <ChevronLeft size={15} aria-hidden="true" /> Previous
        </button>
        <span>PAGE {page}{totalPages ? ` / ${totalPages}` : ''}</span>
        <button type="button" onClick={() => loadArchive(page + 1)} disabled={!hasNextPage || status === 'loading'}>
          Next <ChevronRight size={15} aria-hidden="true" />
        </button>
      </footer>
    </section>
  );
}
