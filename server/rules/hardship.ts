import { all, any, finding, flag, units } from "./common.ts";
import type { Condition } from "./common.ts";
import { monthBounds, validDate, validMonth } from "./dates.ts";
import type { DisasterFacts, HardshipFacts, StateOptions } from "./types.ts";

function disasterCondition(
  month: string,
  asOf: string,
  disaster: DisasterFacts,
): Condition {
  if (
    disaster.declarationType === "FM" ||
    disaster.countyMatchesResidence === false
  )
    return { value: false, missing: [] };
  const missing: string[] = [];
  if (!["DR", "EM", "NEA"].includes(disaster.declarationType as string))
    missing.push("hardship.disaster.declarationType");
  if (disaster.countyMatchesResidence !== true)
    missing.push("hardship.disaster.countyMatchesResidence");
  if (!validDate(disaster.incidentStart))
    missing.push("hardship.disaster.incidentStart");
  if (missing.length) return { value: null, missing };
  const start = disaster.incidentStart as string;
  const bounds = monthBounds(month);
  if (start > bounds.end) return { value: false, missing: [] };
  let period: Condition;
  if (validDate(disaster.incidentEnd) && disaster.incidentEnd >= start) {
    if (month <= disaster.incidentEnd.slice(0, 7))
      period = { value: true, missing: [] };
    else if (disaster.cmsExtendedThrough === null)
      period = { value: false, missing: [] };
    else if (
      validDate(disaster.cmsExtendedThrough) &&
      disaster.cmsExtendedThrough >= disaster.incidentEnd
    )
      period = {
        value: month <= disaster.cmsExtendedThrough.slice(0, 7),
        missing: [],
      };
    else
      period = {
        value: null,
        missing: ["hardship.disaster.cmsExtendedThrough"],
      };
  } else if (
    disaster.incidentEnd === null &&
    disaster.ongoing === true &&
    validDate(disaster.verifiedThrough) &&
    disaster.verifiedThrough <= asOf &&
    disaster.verifiedThrough >= start
  ) {
    period =
      month <= disaster.verifiedThrough.slice(0, 7)
        ? { value: true, missing: [] }
        : { value: null, missing: ["hardship.disaster.verifiedThrough"] };
  } else period = { value: null, missing: ["hardship.disaster.incidentEnd"] };
  if (disaster.declarationType !== "NEA") return period;
  return all([
    period,
    flag(
      disaster.neaAffectsCompliance,
      "hardship.disaster.neaAffectsCompliance",
    ),
    flag(disaster.stateNotifiedCms, "hardship.disaster.stateNotifiedCms"),
  ]);
}

export function checkHardship(
  month: string,
  asOf: string,
  state: StateOptions,
  facts: HardshipFacts,
) {
  const citation = "42 CFR 435.555";
  if (!validMonth(month) || !validDate(asOf))
    return finding(null, "Check the month and review date.", citation, [
      !validMonth(month) ? "month" : "asOf",
    ]);
  if (`${month}-01` > asOf)
    return finding(
      null,
      "A future hardship month is not yet proved.",
      citation,
      ["hardship.futureMonth"],
    );
  if (state.verified !== true)
    return finding(
      null,
      "The state must choose these hardship options.",
      `${citation}(a)`,
      ["state.verified"],
    );
  const checks = [];
  const missing: string[] = [];
  const option = (key: keyof StateOptions): boolean => {
    if (typeof state[key] !== "boolean") missing.push(`state.${key}`);
    return state[key] === true;
  };
  if (option("disasterHardship")) {
    const test = Array.isArray(facts.disasters)
      ? any(facts.disasters.map((item) => disasterCondition(month, asOf, item)))
      : ({ value: null, missing: ["hardship.disasters"] } as Condition);
    checks.push(
      finding(
        test.value,
        "A presidential declaration covers this county and month.",
        `${citation}(d)(2), (e)`,
        test.missing,
        {},
        "Deemed",
      ),
    );
  }
  if (option("unemploymentHardship")) {
    const unemployment = facts.unemployment;
    if (!unemployment) missing.push("hardship.unemployment");
    else if (unemployment.countyMatchesResidence !== false) {
      const county = units(unemployment.countyRate, 100);
      const national = units(unemployment.nationalRate, 100);
      const fields: string[] = [];
      if (county === null || county > 10_000)
        fields.push("hardship.unemployment.countyRate");
      if (national === null || national > 10_000)
        fields.push("hardship.unemployment.nationalRate");
      if (unemployment.appliesToMonth !== month)
        fields.push("hardship.unemployment.appliesToMonth");
      if (unemployment.countyMatchesResidence !== true)
        fields.push("hardship.unemployment.countyMatchesResidence");
      if (fields.length) missing.push(...fields);
      else {
        const threshold = Math.min(1600, (national as number) * 3);
        const high = (county as number) * 2 >= threshold;
        if (high && unemployment.cmsApprovedForMonth !== true)
          missing.push("hardship.unemployment.cmsApprovedForMonth");
        checks.push(
          finding(
            high && unemployment.cmsApprovedForMonth === true,
            high
              ? "The rate meets the line. CMS approval is also needed."
              : "The county rate is below this hardship line.",
            `${citation}(d)(3)`,
            [],
            {
              countyRate: unemployment.countyRate,
              nationalRate: unemployment.nationalRate,
              thresholdPercent: threshold / 200,
            },
            "Deemed",
          ),
        );
      }
    }
  }
  if (option("inpatientHardship")) {
    const test = flag(
      facts.inpatient?.qualifyingCareDuringMonth,
      "hardship.inpatient.qualifyingCareDuringMonth",
    );
    if (test.value !== false) {
      if (facts.inpatient?.requestGranted !== true)
        missing.push("hardship.inpatient.requestGranted");
      checks.push(
        finding(
          all([
            test,
            flag(
              facts.inpatient?.requestGranted,
              "hardship.inpatient.requestGranted",
            ),
          ]).value,
          "The state has granted a request for qualifying care.",
          `${citation}(d)(1)`,
          test.missing,
          {},
          "Deemed",
        ),
      );
    }
  }
  if (option("medicalTravelHardship")) {
    const travel = facts.medicalTravel;
    const test = all([
      flag(
        travel?.qualifyingTravelDuringMonth,
        "hardship.medicalTravel.qualifyingTravelDuringMonth",
      ),
      any([
        flag(travel?.memberTravels, "hardship.medicalTravel.memberTravels"),
        all([
          flag(
            travel?.dependentTravels,
            "hardship.medicalTravel.dependentTravels",
          ),
          flag(
            travel?.leaveForDependentCareOrTravel,
            "hardship.medicalTravel.leaveForDependentCareOrTravel",
          ),
        ]),
      ]),
    ]);
    if (test.value !== false) {
      if (travel?.requestGranted !== true)
        missing.push("hardship.medicalTravel.requestGranted");
      checks.push(
        finding(
          all([
            test,
            flag(
              travel?.requestGranted,
              "hardship.medicalTravel.requestGranted",
            ),
          ]).value,
          "The state has granted a request for medical travel.",
          `${citation}(d)(4)`,
          test.missing,
          {},
          "Deemed",
        ),
      );
    }
  }
  const match = checks.find((check) => check.matched === true);
  if (match) return match;
  missing.push(...checks.flatMap((check) => check.missing));
  return finding(
    missing.length ? null : false,
    missing.length
      ? "A hardship may apply. Check the missing facts or state approval."
      : "No elected hardship is shown for this month.",
    citation,
    missing,
  );
}
