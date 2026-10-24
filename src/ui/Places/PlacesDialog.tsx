import { useEffect, useId, useRef, useState } from 'react';
import { useStore } from '../../store';
import type { SavedLocation } from '../../store/settingsSlice';
import { PLACE_NAME_LIMIT, placeKey } from '../../store/PlacesPersistence';
import controls from '../controls.module.css';
import css from './PlacesDialog.module.css';

interface Props {
  selection: SavedLocation | null;
  onLaunch: (location: SavedLocation) => Promise<boolean>;
  onClose: () => void;
  onReturnToPicker: () => Promise<void>;
}
interface Editor { place: SavedLocation; favoriteKey?: string }

export function PlacesDialog({ selection, onLaunch, onClose, onReturnToPicker }: Props) {
  const favorites = useStore(s => s.favoritePlaces);
  const recent = useStore(s => s.recentPlaces);
  const storageError = useStore(s => s.placesStorageError);
  const [tab, setTab] = useState<'favorites' | 'recent'>('favorites');
  const [editor, setEditor] = useState<Editor | null>(() => selection ? { place: selection } : null);
  const [editError, setEditError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [failedPlace, setFailedPlace] = useState<SavedLocation | null>(null);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const busy = useRef(false);
  const mounted = useRef(true);
  const close = useRef(onClose);
  close.current = onClose;
  const title = useId();
  const nameId = useId();
  const errorId = useId();

  useEffect(() => {
    mounted.current = true;
    const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const element = dialog.current!;
    element.showModal();
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault(); event.stopImmediatePropagation();
        if (!busy.current) close.current();
      }
      if (event.key !== 'Tab') return;
      const focusable = [...element.querySelectorAll<HTMLElement>(':is(button, input):not(:disabled)')];
      const first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    window.addEventListener('keydown', keyboard, true);
    return () => {
      mounted.current = false;
      window.removeEventListener('keydown', keyboard, true);
      element.close();
      if (returnFocus?.isConnected) returnFocus.focus();
    };
  }, []);

  useEffect(() => { nameInput.current?.focus(); nameInput.current?.select(); }, [editor]);

  const launch = async (place: SavedLocation) => {
    if (busy.current) return;
    busy.current = true;
    setLoadingKey(placeKey(place)); setLaunchError(null); setFailedPlace(null);
    try {
      const started = await onLaunch(place);
      if (!mounted.current) return;
      if (started) close.current();
      else { setFailedPlace(place); setLaunchError('Flight did not start. Retry or choose another location.'); }
    } catch {
      if (mounted.current) {
        setFailedPlace(place);
        setLaunchError('Unable to load this place. Retry or choose another location.');
      }
    } finally {
      busy.current = false;
      if (mounted.current) setLoadingKey(null);
    }
  };

  const edit = (place: SavedLocation, favoriteKey?: string) => {
    setEditor({ place, favoriteKey }); setEditError(null); setFeedback(null);
  };
  const save = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editor || busy.current) return;
    const name = String(new FormData(event.currentTarget).get('name') ?? '');
    const state = useStore.getState();
    const error = editor.favoriteKey
      ? state.renameFavorite(editor.favoriteKey, name)
      : state.addFavorite({ ...editor.place, name });
    setEditError(error);
    if (!error) { setEditor(null); setFeedback(editor.favoriteKey ? 'Favorite renamed.' : 'Favorite saved.'); }
  };
  const chooseLocation = async () => {
    if (busy.current) return;
    busy.current = true; setLoadingKey('picker');
    try { await onReturnToPicker(); }
    catch { if (mounted.current) setLaunchError('Unable to return to the map. Try again.'); }
    finally { busy.current = false; if (mounted.current) setLoadingKey(null); }
  };
  const places = tab === 'favorites' ? favorites : recent;
  const isBusy = loadingKey !== null;

  return (
    <dialog ref={dialog} className={css.dialog} aria-labelledby={title}
      onCancel={event => { event.preventDefault(); if (!busy.current) onClose(); }}>
      <header className={css.header}>
        <div><span className={controls.eyebrow}>Flight locations</span><h1 id={title}>Places</h1></div>
        <button type="button" className={controls.quiet} disabled={isBusy} onClick={onClose}>Close</button>
      </header>
      <div className={css.content} aria-busy={isBusy}>
        <nav className={css.tabs} aria-label="Place lists">
          <button type="button" aria-pressed={tab === 'favorites'} disabled={isBusy} onClick={() => setTab('favorites')}>Favorites <span>{favorites.length}</span></button>
          <button type="button" aria-pressed={tab === 'recent'} disabled={isBusy} onClick={() => setTab('recent')}>Recent <span>{recent.length}</span></button>
        </nav>
        {editor && <form className={css.editor} onSubmit={save} key={`${placeKey(editor.place)}:${editor.favoriteKey ?? 'add'}`}>
          <label htmlFor={nameId}>{editor.favoriteKey ? 'Rename favorite' : 'Save a favorite'}</label>
          <div className={css.editActions}>
            <input ref={nameInput} id={nameId} name="name" defaultValue={editor.place.name.slice(0, PLACE_NAME_LIMIT)} maxLength={PLACE_NAME_LIMIT}
              aria-invalid={!!editError} aria-describedby={editError ? errorId : undefined} disabled={isBusy} />
            <button className={controls.secondary} disabled={isBusy}>{editor.favoriteKey ? 'Save name' : 'Save favorite'}</button>
            <button type="button" className={controls.quiet} disabled={isBusy} onClick={() => { setEditor(null); setEditError(null); }}>Cancel</button>
          </div>
          <p className={css.coordinates}>{editor.place.lat.toFixed(6)}, {editor.place.lng.toFixed(6)}</p>
          {editError && <p id={errorId} role="alert" className={css.error}>{editError}</p>}
        </form>}
        {!editor && selection && <button type="button" className={controls.secondary} disabled={isBusy} onClick={() => edit(selection)}>Save selected place</button>}
        {(storageError || feedback) && <p role="status" className={storageError ? css.error : css.feedback}>{storageError ?? feedback}</p>}
        {launchError && <div className={css.failure} role="alert"><p>{launchError}</p><div className={css.editActions}>
          {failedPlace && <button className={controls.secondary} disabled={isBusy} onClick={() => void launch(failedPlace)}>Retry</button>}
          <button className={controls.quiet} disabled={isBusy} onClick={() => void chooseLocation()}>Choose location</button>
        </div></div>}
        {!places.length ? <div className={css.empty}><h2>{tab === 'favorites' ? 'No favorites yet' : 'No recent flights'}</h2>
          <p>{tab === 'favorites' ? 'Save a selected place or bookmark your current position from pause.' : 'Locations appear here after a flight starts successfully.'}</p></div>
          : <ul className={css.list}>{places.map(place => {
            const key = placeKey(place);
            const isFavorite = favorites.some(favorite => placeKey(favorite) === key);
            return <li key={key} className={css.row}>
              <button className={css.launch} disabled={isBusy} onClick={() => void launch(place)} title={`Fly to ${place.name}`}>
                <span className={css.placeName}>{loadingKey === key ? 'Loading…' : place.name}</span>
                <span className={css.coordinates}>{place.lat.toFixed(4)}, {place.lng.toFixed(4)}</span>
              </button>
              <div className={css.rowActions}>
                {tab === 'favorites'
                  ? <button className={controls.quiet} disabled={isBusy} onClick={() => edit(place, key)}>Rename</button>
                  : <button className={controls.quiet} disabled={isBusy || isFavorite} onClick={() => edit(place)}>{isFavorite ? 'Saved' : 'Save'}</button>}
                <button className={controls.quiet} aria-label={`Remove ${place.name} from ${tab}`} disabled={isBusy} onClick={() => {
                  if (tab === 'favorites') useStore.getState().removeFavorite(key);
                  else useStore.getState().removeRecentPlace(key);
                  if (editor?.favoriteKey === key) setEditor(null);
                }}>Remove</button>
              </div>
            </li>;
          })}</ul>}
      </div>
      <footer className={css.footer}>
        <span>Select a place to fly there immediately.</span>
        {tab === 'recent' && recent.length > 0 && <button className={controls.quiet} disabled={isBusy} onClick={() => useStore.getState().clearRecentPlaces()}>Clear recent</button>}
      </footer>
    </dialog>
  );
}
