import { useEffect, useState } from "react";

import { useLanguage } from "../../lib/language";
export function ConnectionNotice() {
  const lang = useLanguage();
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return offline ? (
    <p className="online-state" role="status">
      {lang === "es"
        ? "No tienes conexión. Las herramientas que ya cargaste pueden seguir funcionando. Vuelve a conectarte para abrir otra página."
        : "You are offline. Tools already loaded can keep working. Reconnect to open another page."}
    </p>
  ) : null;
}
