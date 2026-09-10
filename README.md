# Flow Lab — Navier–Stokes

An interactive educational fluid mechanics lab with adjustable parameters, four experiments, and synchronized measurements.

## Open the lab

Download `standalone/flow-lab.html` and open it in a modern desktop browser. The simulation runs locally without a server or internet connection. The external reading links require internet access.

## Explore

- Switch between dye, velocity magnitude, relative pressure, and vorticity.
- Stir, inject dye, draw or erase obstacles, and place a measurement probe.
- Adjust viscosity and inlet speed; pause, restart, or advance one step.
- Turn on streamlines, velocity arrows, or the grid.
- Rotate a height-field view of the selected 2D data.
- Explore equation terms and four guided experiments.
- Read the sourced GPT breakthrough page, including an interactive asymptotic scaling diagram.
- Inspect actual kinetic energy, probe history, and pressure-projection residuals.

Space toggles playback when a control is not focused. Sliders support arrow keys. **Stir at center** applies an impulse without pointer drawing.

## Development

Requires Node.js 22.13 or later.

```sh
npm ci
npm run dev
```

```sh
npm run build
npm run export:standalone
```

## GPT breakthrough page

Open `/gpt-breakthrough` or choose **GPT breakthrough** in the top navigation. The same page is included in the offline HTML version. It explains the September 8, 2026 announcement, distinguishes the internal discovery model from GPT-6 Astra’s reported formalization role, and links the analytical proof, Lean repository, and Clay problem statement. Verification status is explicitly dated September 10, 2026. The scaling diagram illustrates published asymptotic laws; it does not reproduce or verify the proof.

## Model and limitations

The model is a 2D, constant-density incompressible Newtonian fluid in dimensionless units. It uses a staggered MAC grid, semi-Lagrangian momentum transport, explicit viscous diffusion with an adaptive timestep, and iterative pressure projection. Dye is a passive scalar with a small visual fade. Kinematic viscosity is separate from numerical diffusion.

Solid boundaries prevent penetration and use a free-slip tangential approximation. Channel scenes use a fixed inlet and an approximate open outlet. This is a qualitative learning model, not a validated engineering CFD solver, a no-slip cylinder benchmark, or a simulation of three-dimensional turbulence. The surface view is a height visualization of 2D data, not a 3D fluid or free surface. Disabling pressure correction deliberately violates the incompressible model.

Reynolds number uses cylinder diameter for the cylinder scene and container height otherwise. The speed is inlet speed for channels or the current peak speed for closed scenes. Pressure is relative, with density scaled to one. All chart values come from the numerical solution.

References: [Bridson and Müller-Fischer, Fluid Simulation](https://www.cs.ubc.ca/~rbridson/fluidsimulation/fluids_notes.pdf), [MIT, Hydrodynamics and Newton's laws](https://math.mit.edu/~dunkel/Teach/18.354_2015S/slides/L14_HydroNewton.pdf).

## Validation

TypeScript checks and the production build pass. Numerical checks verify pressure correction, viscosity-dependent kinetic-energy decay, finite solutions across all four scenes at high viscosity/inlet settings, reset behavior, and obstacle editing. Research checks cover online/offline navigation and the displayed scaling laws. Run `npm test` for both suites.
