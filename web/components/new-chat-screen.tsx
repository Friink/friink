"use client";

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { AppShellRoute } from '@/components/app-shell-route';
import { Modal } from '@/components/modal';
import { getChatContext, getChatEligibility, loadAuthSession, searchChatPeople, type ApiChatEligibility, type ApiChatPerson } from '@/lib/auth';

type Validation = 'idle' | 'loading' | 'available' | 'unavailable' | 'error';

export function NewChatScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [people, setPeople] = useState<ApiChatPerson[]>([]);
  const [selected, setSelected] = useState<ApiChatPerson | null>(null);
  const [continuing, setContinuing] = useState(false);
  const [searchState, setSearchState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [searchRetry, setSearchRetry] = useState(0);
  const [validation, setValidation] = useState<Validation>('idle');
  const [validationMessage, setValidationMessage] = useState('');
  const [accountKey, setAccountKey] = useState(() => loadAuthSession()?.user.id ?? '');
  const requestVersion = useRef(0);
  const activeAccount = useRef(accountKey);
  const selectedPerson = useRef<ApiChatPerson | null>(null);

  const close = useCallback(() => router.replace('/home'), [router]);

  useEffect(() => {
    const handleAccountSwitch = () => {
      const nextAccount = loadAuthSession()?.user.id ?? '';
      activeAccount.current = nextAccount;
      setAccountKey(nextAccount);
      setQuery('');
      setPeople([]);
      setSelected(null);
      selectedPerson.current = null;
      setSearchState('idle');
      setValidation('idle');
      setValidationMessage('');
      requestVersion.current += 1;
    };
    window.addEventListener('friink-account-switched', handleAccountSwitch);
    return () => window.removeEventListener('friink-account-switched', handleAccountSwitch);
  }, []);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) return;
    const requestId = ++requestVersion.current;
    const timer = window.setTimeout(() => {
      const session = loadAuthSession();
      if (!session) {
        setSearchState('error');
        return;
      }
      setSearchState('loading');
      searchChatPeople(session.accessToken, term)
        .then((items) => {
          if (requestVersion.current !== requestId || activeAccount.current !== session.user.id) return;
          setPeople(items);
          setSearchState('ready');
        })
        .catch(() => {
          if (requestVersion.current !== requestId) return;
          setPeople([]);
          setSearchState('error');
        });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query, accountKey, searchRetry]);

  async function validatePerson(person: ApiChatPerson): Promise<ApiChatEligibility | null> {
    const session = loadAuthSession();
    if (!session || session.user.id !== activeAccount.current) return null;
    const requestId = ++requestVersion.current;
    setSelected(person);
    selectedPerson.current = person;
    setValidation('loading');
    setValidationMessage('Checking availability…');
    try {
      const eligibility = await getChatEligibility(session.accessToken, person.username);
      if (requestVersion.current !== requestId || activeAccount.current !== session.user.id) return null;
      if (!eligibility.can_send) {
        setValidation('unavailable');
        setValidationMessage('This person is unavailable for chat.');
        return null;
      }
      setValidation('available');
      setValidationMessage(eligibility.status === 'pending_receiver' ? 'You can reply to this request.' : 'Available to chat.');
      return eligibility;
    } catch {
      if (requestVersion.current !== requestId) return null;
      setValidation('unavailable');
      setValidationMessage('This person is unavailable for chat.');
      return null;
    }
  }

  async function continueToChat() {
    if (!selected || validation === 'loading' || continuing) return;
    setContinuing(true);
    try {
      setValidation('loading');
      setValidationMessage('Checking availability…');
      const eligibility = await validatePerson(selected);
      if (!eligibility || selectedPerson.current?.id !== selected.id) return;
      const session = loadAuthSession();
      if (!session || activeAccount.current !== session.user.id) return;
      const context = await getChatContext(session.accessToken, selected.username);
      if (!context.can_send || activeAccount.current !== loadAuthSession()?.user.id) {
        setValidation('unavailable');
        setValidationMessage('This person is unavailable for chat.');
        return;
      }
      if (context.conversation) router.push(`/chats/${context.conversation.id}`);
      else router.push(`/${encodeURIComponent(selected.username)}/chat`);
    } catch {
      setValidation('unavailable');
      setValidationMessage('This person is unavailable for chat.');
    } finally {
      setContinuing(false);
    }
  }

  return <>
    <AppShellRoute initialScreen="messages" />
    <Modal title="New chat" onClose={close} className="new-chat-modal" actions={<>
      <button className="button-secondary" type="button" onClick={close}>Cancel</button>
      <button className="button-primary" type="button" disabled={!selected || validation !== 'available' || continuing} onClick={() => void continueToChat()}>
        {validation === 'loading' || continuing ? 'Checking…' : 'Next'}
      </button>
    </>}>
      <div className="new-chat-content">
        <label className="new-chat-search-label" htmlFor="new-chat-search">Find someone to chat with</label>
        <input
          id="new-chat-search"
          className="new-chat-search"
          type="search"
          value={query}
          autoFocus
          onChange={(event) => {
            const value = event.target.value;
            requestVersion.current += 1;
            setQuery(value);
            setSelected(null);
            selectedPerson.current = null;
            setValidation('idle');
            setValidationMessage('');
            if (value.trim().length < 2) {
              setPeople([]);
              setSearchState('idle');
            }
          }}
          placeholder="Search by name or username"
          autoComplete="off"
          aria-describedby="new-chat-status"
        />
        <div className="new-chat-results" role="group" aria-label="People">
          {query.trim().length < 2 ? <p className="new-chat-hint">Type at least 2 characters to search.</p> : null}
          {searchState === 'loading' ? <p className="new-chat-hint" role="status">Searching…</p> : null}
          {searchState === 'error' ? <p className="new-chat-hint" role="alert">Search is unavailable. <button className="new-chat-retry" type="button" onClick={() => setSearchRetry((value) => value + 1)}>Try again</button></p> : null}
          {searchState === 'ready' && people.length === 0 ? <p className="new-chat-hint">No people found.</p> : null}
          {people.map((person) => {
            const isSelected = selected?.id === person.id;
            return <button
              type="button"
              aria-pressed={isSelected}
              aria-label={`Select ${person.display_name || person.username}, @${person.username}`}
              className={`new-chat-person${isSelected ? ' is-selected' : ''}`}
              key={person.id}
              onClick={() => { void validatePerson(person); }}
            >
              <Image className="new-chat-avatar" src={person.profile_picture_url || '/media/profile.jpg'} alt="" width={44} height={44} unoptimized />
              <span className="new-chat-person-copy"><strong>{person.display_name || person.username}</strong><span>@{person.username}</span></span>
              {isSelected ? <i className="fa-solid fa-check" aria-hidden="true" /> : null}
            </button>;
          })}
        </div>
        <p id="new-chat-status" className={`new-chat-status${validation === 'unavailable' || validation === 'error' ? ' is-error' : ''}`} aria-live="polite">{validationMessage}</p>
      </div>
    </Modal>
  </>;
}
