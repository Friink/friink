'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';

type ShellStateStore = {
  get<T>(scope: string, key: string, initial: T): T;
  set<T>(scope: string, key: string, value: T): void;
};

const ShellStateContext = createContext<ShellStateStore | null>(null);

export function AppShellStateProvider({ children }: { children: ReactNode }) {
  const values = useRef(new Map<string, unknown>());
  const store = useMemo<ShellStateStore>(() => ({
    get<T>(scope: string, key: string, initial: T): T {
      const compoundKey = `${scope}:${key}`;
      return values.current.has(compoundKey) ? values.current.get(compoundKey) as T : initial;
    },
    set<T>(scope: string, key: string, value: T) {
      values.current.set(`${scope}:${key}`, value);
    },
  }), []);

  return <ShellStateContext.Provider value={store}>{children}</ShellStateContext.Provider>;
}

export function useAppShellState<T>(scope: string, key: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const store = useContext(ShellStateContext);
  if (!store) throw new Error('AppShellStateProvider is required for app shell state.');
  const identity = `${scope}:${key}`;
  const [state, setState] = useState(() => ({ identity, value: store.get(scope, key, initial) }));
  const value = state.identity === identity ? state.value : store.get(scope, key, initial);

  const setPersistentValue = useCallback<Dispatch<SetStateAction<T>>>((nextValue) => {
    const resolved = typeof nextValue === 'function'
      ? (nextValue as (previous: T) => T)(store.get(scope, key, initial))
      : nextValue;
    store.set(scope, key, resolved);
    setState({ identity, value: resolved });
  }, [identity, initial, key, scope, store]);

  return [value, setPersistentValue];
}
