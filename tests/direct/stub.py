"""A tiny in-memory GenVM stand-in: enough to run the four contracts end to end in plain Python."""
import sys, types, importlib.util
from pathlib import Path
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parents[2]


class Address(str):
    def __new__(cls, v):
        return super().__new__(cls, str(v).lower())

    @property
    def as_hex(self):
        return str(self)


class TreeMap(dict):
    def __class_getitem__(cls, item):
        return cls


class DynArray(list):
    def __class_getitem__(cls, item):
        return cls


class UserError(Exception):
    pass


class _Return:
    def __init__(self, calldata):
        self.calldata = calldata


class _Write:
    def __call__(self, f):
        return f

    @staticmethod
    def payable(f):
        return f


REGISTRY, QUEUE, TRANSFERS = {}, [], []


class _Contract:
    def __new__(cls, *a, **k):
        obj = object.__new__(cls)
        for name, ann in getattr(cls, '__annotations__', {}).items():
            if ann is TreeMap:
                setattr(obj, name, TreeMap())
            elif ann is DynArray:
                setattr(obj, name, DynArray())
        return obj


class _Handle:
    def __init__(self, target, caller):
        self.target, self.caller = target, caller

    def view(self):
        return self

    def emit(self, on=None):
        return _Emit(self.target, self.caller)

    def __getattr__(self, name):
        return lambda *a, **k: call(self.target, name, a, k, sender=self.caller)


class _Emit:
    def __init__(self, target, caller):
        self.target, self.caller = target, caller

    def __getattr__(self, name):
        return lambda *a, **k: QUEUE.append((self.target, name, a, k, self.caller))


def call(target, name, args=(), kwargs=None, sender=None, value=0):
    saved = gl.message
    gl.message = SimpleNamespace(sender_address=Address(sender), contract_address=Address(target.addr),
                                 value=value, chain_id=61999)
    try:
        return getattr(target, name)(*args, **(kwargs or {}))
    finally:
        gl.message = saved


def flush():
    while QUEUE:
        target, name, a, k, caller = QUEUE.pop(0)
        call(target, name, a, k, sender=caller)


gl = types.ModuleType('genlayer')
gl.gl = gl
gl.Contract = _Contract
gl.contract = SimpleNamespace(Contract=_Contract)
gl.public = SimpleNamespace(view=lambda f: f, write=_Write())
gl.storage = SimpleNamespace(TreeMap=TreeMap, DynArray=DynArray)
gl.vm = SimpleNamespace(UserError=UserError, Return=_Return, run_nondet_unsafe=None)
gl.nondet = SimpleNamespace()
gl.message = SimpleNamespace(sender_address=Address('0x0'), contract_address=Address('0x0'), value=0, chain_id=61999)
gl.message_raw = {'datetime': '2026-10-18T10:00:00Z'}
gl.get_contract_at = lambda addr: _Handle(REGISTRY[str(addr).lower()], gl.message.contract_address)


def _iface(cls):
    class Bound:
        def __init__(self, addr):
            self.addr = addr

        def emit_transfer(self, value=0):
            TRANSFERS.append((str(self.addr).lower(), int(value)))
    return Bound


gl.evm = SimpleNamespace(contract_interface=_iface)
gl.Address, gl.u256, gl.TreeMap, gl.DynArray = Address, int, TreeMap, DynArray
gl.__all__ = ['gl', 'Address', 'u256', 'TreeMap', 'DynArray']
sys.modules['genlayer'] = gl


def load(name):
    spec = importlib.util.spec_from_file_location('fp_' + name, ROOT / 'contracts' / (name + '.py'))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def deploy(mod, cls, addr, sender, *args):
    inst = getattr(mod, cls).__new__(getattr(mod, cls))
    inst.addr = addr
    REGISTRY[addr] = inst
    call(inst, '__init__', args, sender=sender)
    return inst
