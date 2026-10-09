# MaleCNS anatomical sample

Dataset: MaleCNS v1.0, FlyEM (HHMI Janelia), University of Cambridge,
MRC Laboratory of Molecular Biology, and Google Research.

Source: https://male-cns.janelia.org/download/

License: Creative Commons Attribution 4.0 International.
https://creativecommons.org/licenses/by/4.0/

Two descending neuron skeletons: DNge104_R (body 12781) and
DNge104_L (body 556329). Original SWC coordinates in 8 nm voxel units
are converted to micrometers. Skeleton topology is retained.

The anatomy inspector displays this measured geometry. The expedition uses
a separate, simplified software learning controller; these skeletons do not
drive it and are not animated as if their neural activity had been measured.

Reproduce the download using scripts/fly/import-anatomy.py.
