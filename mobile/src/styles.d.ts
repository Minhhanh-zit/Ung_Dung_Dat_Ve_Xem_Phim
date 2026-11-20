// CSS files are processed by Expo/Metro. These declarations are for TypeScript only.
// Keep this file as a global ambient declaration (do not add top-level exports).
declare module '*.module.css' {
  const classes: Record<string, string>;
  export default classes;
}

declare module '*.css';
