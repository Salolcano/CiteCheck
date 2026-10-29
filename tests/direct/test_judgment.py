"""Runs the REAL leader/validator glue (not a fake) against a stubbed web + LLM."""
import json, pytest
from types import SimpleNamespace
from tests.direct import stub
from tests.direct.stub import gl

PAGE = 'https://acme.example/pricing'
EVID = 'https://status.acme.example/history'
QUOTE = '99.99% uptime guaranteed'
PAGE_TEXT = '<h1>99.99% uptime guaranteed*</h1><small>* excludes scheduled maintenance windows</small>' + ' filler' * 80
EVID_TEXT = '<p>Status history: uptime was 97.1% in March because of an outage.</p>' + ' filler' * 80


def setup(llm_answers, pages=None):
    m = stub.load('citecheck')
    pages = pages if pages is not None else {PAGE: PAGE_TEXT, EVID: EVID_TEXT}
    calls = {'n': 0}

    def render(url, mode='text'):
        if url not in pages:
            raise RuntimeError('unreachable')
        return pages[url]

    def exec_prompt(prompt, response_format=None):
        ans = llm_answers[min(calls['n'], len(llm_answers) - 1)]
        calls['n'] += 1
        return ans

    gl.nondet = SimpleNamespace(web=SimpleNamespace(render=render, get=lambda u: (_ for _ in ()).throw(RuntimeError())), exec_prompt=exec_prompt)
    return m


def run_default(leader, validator):
    value = leader()
    assert validator(stub._Return(value)) is True, 'validator rejected an honest leader'
    return value


def contradicted():
    return {'verdict': 'MISREPRESENTS', 'framing': 'OVERSTATED', 'about_person': 'no',
            'citations': [{'url': EVID, 'quote': 'uptime was 97.1% in March because of an outage'}]}


def test_consensus_glue_default_runner_name():
    m = setup([contradicted()])
    gl.vm.run_nondet_default = run_default
    d = m.judgment(PAGE, QUOTE, [EVID])
    assert d['verdict'] == 'MISREPRESENTS' and d['quote_found'] and d['citations'][0]['url'] == EVID
    assert set(d['digests']) == {PAGE, EVID}
    del gl.vm.run_nondet_default


def test_falls_back_to_unsafe_runner_name():
    m = setup([contradicted()])
    gl.vm.run_nondet_unsafe = run_default
    assert m.judgment(PAGE, QUOTE, [EVID])['verdict'] == 'MISREPRESENTS'
    del gl.vm.run_nondet_unsafe


def test_validator_rejects_a_different_verdict():
    m = setup([contradicted(), {'verdict': 'NOT_FOUND', 'framing': 'OVERSTATED', 'about_person': 'no', 'citations': []}])
    outcome = {}

    def run(leader, validator):
        v = leader()
        outcome['accepted'] = validator(stub._Return(v))
        return v
    gl.vm.run_nondet_default = run
    m.judgment(PAGE, QUOTE, [EVID])
    assert outcome['accepted'] is False
    del gl.vm.run_nondet_default


def test_validator_rejects_error_results_and_tolerates_hype_disagreement():
    m = setup([contradicted(), {**contradicted(), 'framing': 'FAIR'}])
    seen = {}

    def run(leader, validator):
        v = leader()
        seen['error'] = validator(stub.UserError('leader failed'))
        seen['hype'] = validator(stub._Return(v))
        return v
    gl.vm.run_nondet_default = run
    m.judgment(PAGE, QUOTE, [EVID])
    assert seen['error'] is False and seen['hype'] is True
    del gl.vm.run_nondet_default


def test_fabricated_citation_collapses_to_unsupported_and_missing_quote_flagged():
    fake = {**contradicted(), 'citations': [{'url': EVID, 'quote': 'a sentence the page never contained'}]}
    m = setup([fake], pages={PAGE: 'Totally different page text about something else entirely. ' * 10, EVID: EVID_TEXT})
    gl.vm.run_nondet_default = run_default
    d = m.judgment(PAGE, QUOTE, [EVID])
    assert d['verdict'] == 'NOT_FOUND' and d['quote_found'] is False
    del gl.vm.run_nondet_default


def test_unreachable_sources_are_not_in_digests():
    m = setup([contradicted()], pages={PAGE: PAGE_TEXT})
    gl.vm.run_nondet_default = run_default
    d = m.judgment(PAGE, QUOTE, [EVID])
    assert EVID not in d['digests'] and d['verdict'] == 'NOT_FOUND'
    del gl.vm.run_nondet_default
