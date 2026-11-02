# TRACER's settings (upstream reads them from the command line, config.py), fixed at its defaults. Only the arch
# and its input size differ between TE-0 to TE-4: frequency_radius, denoise and gamma are the same for each.
IMG_SIZE = {'0': 320, '1': 320, '2': 352, '3': 384, '4': 448, '5': 512, '6': 576, '7': 640}          # (upstream's README: TE-0 and TE-1 at 320, TE-2 352, TE-3 384, TE-4 448, TE-5 512, TE-6 576, TE-7 640)


class _Cfg:
    RFB_aggregated_channel = [32, 64, 128]
    frequency_radius = 16
    denoise = 0.93
    gamma = 0.1

    def __init__(self, arch='0'):
        assert arch in IMG_SIZE, arch
        self.arch = arch


cfg = _Cfg('0')          # (the module-wide one: TE-0, what every model's shared settings are read from)


def cfg_for(arch):
    """The settings for one model: TRACER(cfg_for('2')) is TE-2, beside a TE-0 in the same process."""
    return _Cfg(str(arch))
