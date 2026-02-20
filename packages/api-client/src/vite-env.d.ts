// Declare Vite's import.meta.env so this package type-checks
// without requiring vite as a dependency.
interface ImportMeta {
  readonly env: Record<string, string | undefined>;
}
