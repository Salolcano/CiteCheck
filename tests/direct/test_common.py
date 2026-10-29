import pytest
from tests.direct import stub
from tests.direct.stub import UserError

m = stub.load('citecheck')
PAGE = 'https://acme.example/pricing'


def inputs(text, other=None):
    texts = {PAGE: m.canonical(text)}
    if other:
        texts.update({k: m.canonical(v) for k, v in other.items()})
    return {'texts': texts, 'digests': {k: m.fingerprint(v) for k, v in texts.items()}}


def test_public_url_rejects_unsafe():
    for bad in ['http://a.example', 'https://localhost/x', 'https://10.0.0.1/x', 'https://a.local/x',
                'https://u:p@a.example/x', 'https://a.example:8443/x', 'https://a.example/x#frag', 'ftp://a.example']:
        with pytest.raises(UserError):
            m.public_url(bad)
    assert m.public_url('https://status.acme.example/history') == 'https://status.acme.example/history'


def test_grounding_drops_fabricated_quotes_and_self_citation():
    inp = inputs('<p>99.99% uptime guaranteed*</p><small>* excludes scheduled maintenance windows</small>',
                 {'https://status.acme.example/history': 'Status history: uptime was 97.1% in March because of an outage.'})
    src = 'https://status.acme.example/history'
    raw = {'verdict': 'MISREPRESENTS', 'framing': 'OVERSTATED', 'about_person': 'no',
           'citations': [{'url': src, 'quote': 'uptime was 97.1% in March because of an outage'}]}
    d = m.grounded(raw, inp, PAGE, [src], '99.99% uptime guaranteed')
    assert d['verdict'] == 'MISREPRESENTS' and d['quote_found'] and len(d['citations']) == 1
    fake = dict(raw, citations=[{'url': src, 'quote': 'this sentence was invented by a model'}])
    assert m.grounded(fake, inp, PAGE, [src], '99.99% uptime guaranteed')['verdict'] == 'NOT_FOUND'
    # the post cannot be its own source, even with a real quote from it
    selfcite = dict(raw, verdict='SUPPORTS', citations=[{'url': PAGE, 'quote': '* excludes scheduled maintenance windows'}])
    assert m.grounded(selfcite, inp, PAGE, [src], '99.99% uptime guaranteed')['verdict'] == 'NOT_FOUND'
    # a URL that was not supplied as a cited source is ignored
    other = dict(raw, citations=[{'url': 'https://other.example/x', 'quote': 'uptime was 97.1% in March because of an outage'}])
    assert m.grounded(other, inp, PAGE, [src], '99.99% uptime guaranteed')['verdict'] == 'NOT_FOUND'


def test_quote_match_survives_typography_only():
    inp = inputs('We\u2019re \u201cthe fastest\u201d \u2014 always.')
    d = m.grounded({'verdict': 'NOT_FOUND', 'framing': 'OVERSTATED', 'about_person': 'no'}, inp, PAGE, [], 'We\'re "the fastest" - always.')
    assert d['quote_found']
    d2 = m.grounded({'verdict': 'NOT_FOUND', 'framing': 'OVERSTATED', 'about_person': 'no'}, inp, PAGE, [], 'we\'re "the fastest" - always.')
    assert not d2['quote_found']  # case-sensitive


def test_invalid_labels_raise_and_fenced_json_parses():
    with pytest.raises(UserError):
        m.grounded({'verdict': 'MAYBE', 'framing': 'OVERSTATED', 'about_person': 'no'}, inputs('x'), PAGE, [], 'x')
    assert m.parse_model('```json\n{"a": 1}\n```') == {'a': 1}


def test_compared_ignores_digests_and_quote_spans():
    a = {'verdict': 'SUPPORTS', 'framing': 'FAIR', 'about_person': 'no', 'quote_found': True,
         'citations': [{'url': 'u1', 'quote': 'one'}], 'digests': {'u1': 'x'}}
    b = {**a, 'citations': [{'url': 'u1', 'quote': 'different span'}], 'digests': {'u1': 'y'}}
    assert m.compared(a) == m.compared(b)
