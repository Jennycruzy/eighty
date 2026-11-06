import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import {
  exampleCopy,
  exampleStatus,
  fill,
  type ExamplePerson,
} from "../lib/example";
import { useLanguage, languageLink } from "../lib/language";

export function ExampleNotice() {
  const lang = useLanguage();
  const { pathname } = useLocation();
  const [person, setPerson] = useState<ExamplePerson | null>(null);
  useEffect(() => {
    let active = true;
    exampleStatus()
      .then((result) => {
        if (active && result.example && result.person) setPerson(result.person);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [pathname]);
  if (!person || !["/example", "/add", "/review"].includes(pathname))
    return null;
  const copy = exampleCopy(lang);
  return (
    <p className="note example-notice">
      {fill(copy.month.exampleNote, { name: copy.people[person].name })}{" "}
      <Link to={languageLink("/", lang)}>{copy.month.home}</Link>
    </p>
  );
}
