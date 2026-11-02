"""Read state contact details from CMS. Do not guess missing fields."""
import datetime
import html
import json
import pathlib
import re
import urllib.request

SOURCE = 'https://www.medicaid.gov/about-us/where-can-people-get-help-medicaid-chip'
MAP = 'https://www.medicaid.gov/medicaid/map-element-medicaid-and-chip-enrollment'
CODES = set('AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split())
def text(value):
    return ' '.join(html.unescape(re.sub('<[^>]*>', ' ', value)).split()).removeprefix('★').strip()

def extract(document, checked, expansion, expansion_source):
    rows = []
    for match in re.finditer(r'<h3\s+id="([A-Z]{2})"[^>]*>(.*?)</h3>(.*?)(?=<h3\s|$)', document, re.S):
        code, name, body = match.groups()
        if code not in CODES:
            continue
        heading = re.search(r'<h4[^>]*>(.*?)</h4>', body, re.S)
        agency = text(heading.group(1)) if heading else None
        links = [(html.unescape(url), text(label)) for url, label in re.findall(r'<a\b[^>]*href="([^"]+)"[^>]*>(.*?)</a>', body, re.S)]
        contact = next((url for url, label in links if 'State Contacts' in label), None)
        enrollment = next((url for url, label in links if label == 'Enrollment'), None)
        phones = [{'number': label, 'href': 'tel:' + re.sub(r'[^+0-9]', '', url[4:])} for url, label in links if url.startswith('tel:')]
        values = {'name': text(name), 'agency': agency, 'contactUrl': contact, 'enrollmentUrl': enrollment, 'phones': phones}
        provenance = {field: {'source': SOURCE + '#' + code, 'checkedOn': checked} for field in values}
        provenance['expandedMedicaid'] = {'source': expansion_source, 'checkedOn': checked}
        rows.append({'code': code, **values, 'expandedMedicaid': expansion[text(name)], 'profileStatus': 'federal-baseline', 'fieldSources': provenance})
    assert len(rows) == 51 and {row['code'] for row in rows} == CODES
    return sorted(rows, key=lambda row: row['name'])

if __name__ == '__main__':
    with urllib.request.urlopen(SOURCE, timeout=30) as response:
        document = response.read().decode()
    with urllib.request.urlopen(MAP, timeout=30) as response:
        map_html = response.read().decode()
    match = re.search(r'"enrollment_by_state":"([^"]+)"', map_html)
    assert match, 'CMS map data URL not found; keep the prior file.'
    expansion_source = 'https://www.medicaid.gov' + json.loads('"' + match.group(1) + '"')
    with urllib.request.urlopen(expansion_source, timeout=30) as response:
        enrollment = json.load(response)
    enrollment = [row for row in enrollment if row.get('state')]
    assert all(row['medicaid_expansion'] in ('Y', 'N') for row in enrollment)
    expansion = {row['state']: row['medicaid_expansion'] == 'Y' for row in enrollment}
    assert len(expansion) == 51
    rows = extract(document, datetime.date.today().isoformat(), expansion, expansion_source)
    pathlib.Path('data/states.json').write_text(json.dumps(rows, indent=2) + '\n')
    print(f'Read {len(rows)} state and DC entries from CMS. Links and dates still need state-level review.')
