# React + TypeScript Cheat Sheet

---

## TypeScript

### Interfaces & Types

```ts
// Basic interface
interface User {
    id: number;
    name: string;
    email?: string;          // optional field
}

// Union type
type Status = "pending" | "active" | "inactive"

// Generic utility type — map of keys to values
type ColorMap = Record<Status, string>

// Generic function — T is a placeholder for any type
async function fetchData<T>(url: string): Promise<T> {
    const res = await fetch(url)
    return res.json() as Promise<T>
}
```

### Imports

```ts
import type { User } from './types'    // type-only, erased at runtime
import { fetchUser } from './api'      // value import
```

### Nullability

```ts
user?.name                  // optional chaining — undefined if user is null
user?.name ?? 'Anonymous'   // nullish coalescing — fallback if null/undefined
user!.name                  // non-null assertion — tell TS it's definitely defined
```

### Type Conversion at Boundaries

```ts
// APIs and HTML inputs always return strings — convert explicitly
parseInt("42")              // → 42
parseFloat("3.14")          // → 3.14
Number(e.target.value)      // → number (from any input event)
```

---

## JavaScript Patterns

### Destructuring

```ts
// Array destructuring — position matters, names are up to you
const [value, setValue] = useState(0)

// Object destructuring — names must match keys
const { name, email } = user

// Rename destructuring — pull out key under a new name
const { data: userData, isLoading: userLoading } = useQuery(...)
```

### Arrow Functions

```ts
// Single expression — implicit return
const double = (x: number) => x * 2

// Block body — explicit return needed
const process = (x: number) => {
    const result = x * 2
    return result
}
```

### Array Methods

```ts
items.map(item => item.name)              // transform every item
items.map((item, i) => ...)              // i is the index (0-based)
items.filter(item => item.active)         // keep items where true
items.find(item => item.id === id)        // first match or undefined
items.some(item => item.error)            // true if ANY item matches
items.every(item => item.done)            // true if ALL items match
items.at(-1)                              // last item (-1 = from end)
items.sort((a, b) => b.value - a.value)  // descending sort (a - b = ascending)
items.filter(...) ?? []                   // guarantee an array (never undefined)
```

### Spread Operator

```ts
const merged = { ...base, results: newResults }   // override specific keys
Math.max(...speeds)                               // spread array as individual args
```

### Type Guards

```ts
// Tell TypeScript what type remains after filtering
items.filter((s): s is number => s !== null)   // removes null, type becomes number[]
```

### Date Comparison

```ts
const now = new Date()
new Date(session.date_start) < now   // true if session is in the past
```

---

## React

### Exports

```ts
export default function MyComponent() {}   // one per file, imported without {}
export function helperFn() {}              // named, imported with {}
export const MY_CONST = 42                 // named
```

### JSX Patterns

```tsx
// Conditional rendering
{isLoading && <Spinner />}
{error ? <Error /> : <Content />}

// Lists — always needs a key
{items.map(item => (
    <div key={item.id}>{item.name}</div>
))}

// Fragment — groups elements without adding a DOM node
<>
    <h1>Title</h1>
    <p>Body</p>
</>
```

### useState vs External Stores

```ts
// Local state — lives inside one component
const [count, setCount] = useState(0)

// Global state (Zustand) — any component can read/write
const { count, setCount } = useMyStore()
```

---

## Zustand

```ts
import { create } from 'zustand'

interface StoreState {
    value: number
    setValue: (v: number) => void
}

export const useMyStore = create<StoreState>((set) => ({
    value: 0,
    setValue: (v) => set({ value: v }),
}))

// In any component:
const { value, setValue } = useMyStore()
```

---

## TanStack Query (React Query v5)

```tsx
// Wrap your app once at the root
const queryClient = new QueryClient()
<QueryClientProvider client={queryClient}>
    <App />
</QueryClientProvider>

// Basic query
const { data, isLoading, error } = useQuery({
    queryKey: ['users', userId],      // cache address — include all dependencies
    queryFn: () => fetchUser(userId), // async function that returns data
    staleTime: 1000 * 60 * 60,       // how long before refetching (ms)
})

// Dependent query — only runs when enabled is true
const { data: profile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: () => fetchProfile(user!.id),
    enabled: !!user,                  // !! converts to boolean
})

// Parallel dynamic queries
const results = useQueries({
    queries: items.map(item => ({
        queryKey: ['item', item.id],
        queryFn: () => fetchItem(item.id),
        enabled: !!items,
    }))
})
// results is an array — one { data, isLoading, error } per item
```

---

## React Router v6

```tsx
// main.tsx / App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'

function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/profile/:id" element={<Profile />} />
            </Routes>
        </BrowserRouter>
    )
}

// Read URL params inside a page
import { useParams } from 'react-router-dom'
const { id } = useParams()
```

---

## Tailwind CSS

```
Layout:     flex flex-col gap-4 p-4 w-full min-h-screen
Text:       text-sm text-[#999] font-semibold font-mono uppercase tracking-wider
Colors:     bg-[#111118] text-[#e8e8f0] border-[#1e1e2e] accent-[#e10600]
Border:     border border-b rounded
Spacing:    py-2 px-4 mb-3 w-8
Hover:      hover:bg-[#111118]
```

Square brackets `[value]` let you use any arbitrary value when the preset scale doesn't cover your need.

---

## Further Reading

- [TypeScript Handbook — Generics](https://www.typescriptlang.org/docs/handbook/2/generics.html)
- [React Docs — Hooks](https://react.dev/reference/react/hooks)
- [TanStack Query Docs](https://tanstack.com/query/latest/docs/framework/react/overview)
- [Zustand Docs](https://docs.pmnd.rs/zustand/getting-started/introduction)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)
- [React Router Docs](https://reactrouter.com/en/main)
