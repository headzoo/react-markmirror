React Markmirror
==================
A WYSIWYG markdown editor for [React](http://facebook.github.io/react) which uses [CodeMirror](https://codemirror.net).

An demo is available at https://stories.headzoo.io/react-markmirror.

* [Features](#features)
* [Installation](#installation)
* [Example](#example)
* [Props](docs/props.md)
* [Methods](docs/methods.md)
* [Themes](docs/themes.md)
* [Styling](docs/styling.md)
* [Button Customizing](docs/button.md)
* [Toolbar Customizing](docs/toolbar.md)
* [Dropping and Uploading Files](docs/uploading.md)
* [Storybook](docs/storybook.md)

## Features

![Standard screenshot](docs/images/standard.png)

* Syntax highlighting with themes.
* Drag and drop file uploading.

## Installation
The module is installed using npm, and sets 'react' and 'prop-types' as peer dependencies. Meaning they must be installed separately.

```
npm install react-markmirror react prop-types --save
```


## Example

```js
import React from 'react';
import ReactDOM from 'react-dom';
import Markmirror from 'react-markmirror';

class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      code: ''
    };
  }

  handleChange = (code) => {
    this.setState({ code });
  };

  render() {
    return (
      <Markmirror
        value={this.state.code}
        onChange={this.handleChange}
      />
    );
  }
}

ReactDOM.render(<App />, document.getElementById('app'));
```
