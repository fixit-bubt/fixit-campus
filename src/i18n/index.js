// i18n entry point. Usage in any component:
//   const t = useT();
//   <h1>{t.auth.login.title}</h1>
// Language comes from the persisted AppProvider `lang` state (src/data/store.jsx).
import { useApp } from "../data/store.jsx";
import { en } from "./en.js";
import { bn } from "./bn.js";

const DICTS = { en, bn };

export function useT() {
  const { lang } = useApp();
  return DICTS[lang] || en;
}

export { en, bn };
