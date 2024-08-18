# Getting Started

Getting started with local development happens in two parts, cloning this repository and setting up your Retool application to listen to it.

## Setting up local environment

```shell
yarn install
yarn dev
```

After starting the webpack dev server with `yarn dev` and the example dev server servers your built javascript at `http://localhost:8080/main.js`. Once the dev server is running, open up a Retool application, drag a custom component in and place the following in the iframe code:

```html
<script type="text/javascript" src="http://localhost:8080/index.js" />
```
'''iframe code cdn
<script src="https://cdn.jsdelivr.net/gh/pmcgie/custom_component_editable_pivot_spreadsheet@latest/dist/index.js" />
