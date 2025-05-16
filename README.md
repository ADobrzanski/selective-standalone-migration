# Selective standalone migration

Migrate to standalone one component at a time.

## Description

> [!WARNING]  
> The project, though functional, is in the alpha stage. Expect bugs and relatively frequent changes.

Angular Schematic automating the standalone migration for a single selected component (whenever possible).

The script will look for obvious circular dependencies and help you handle some of the cases.

## Features

- Search and refactor selected component to standalone.
- Migrate same module dependencies to prevent creating circular dependencies.
- Browse template dependency tree (WEB UI only).

## Usage

### Installation

```
npm i -D selective-standalone
```

### Running the schematic

This depends on whether and how `@angular-devkit/schematics-cli` is installed.

Not installed:

```
npx @angular-devkit/schematics-cli selective-standalone:run
```

Installed within project:

```
npx schematics selective-standalone:run
```

Installed globally:  
  
```
schematics selective-standalone:run
```

### Usage examples

_SOON_

**TL;DR:**
Follow instructions in the terminal to operate.

## Development

_SOON_

**TL;DR:**
- Requires `node` (developed using v22.14.0).
- Run `npm i` to install dependencies.
- Run `npm run build` to build the project (this will create `/dist` directory).
- For quick iteration:
  - Run `npm link` within this project's category
  - Run `npm link selective-standalone` within your Angular project
  - `selective-standalone` should be now available as if installed
  - No need to re-link after `npm run build`, just re-run the schematic itself.

## License

This project is licensed under the MIT License - see the LICENSE.md file for details.

## Acknowledgments

Inspiration, code snippets, etc.
* Angular's [standalone-migration](https://github.com/angular/angular/blob/8e2ca25e26b1204528c27c1104f8b5f865e03731/packages/core/schematics/ng-generate/standalone-migration/to-standalone.ts#L131)
* [awesome-readme](https://github.com/matiassingers/awesome-readme)
