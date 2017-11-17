import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import CodeMirror from 'codemirror';

import 'codemirror/mode/markdown/markdown';
import 'codemirror/addon/edit/continuelist';
import 'codemirror/addon/selection/active-line';
import 'codemirror/addon/dialog/dialog';
import 'codemirror/addon/search/search';
import 'codemirror/addon/search/jump-to-line';

import enLocale from '../locales/en';
import * as commands from '../commands';
import { mimeIsMatch, mimeTypeIsMatch } from '../utils/mime';
import { cssAddClass, cssRemoveClass } from '../utils/css';
import { CSS_PREFIX, THEMES, DROP_TYPE_IMAGE, DROP_TYPE_LINK } from '../const';
import { isSupported, isFullScreen, requestFullscreen, exitFullscreen } from '../utils/fullscreen';
import { objectKeyFilter, objectForEach, objectAssign } from '../utils/objects';

import handlerDataURI from '../handlers/handlerDataURI';
import handlerUpload from '../handlers/handlerUpload';
import handlerPrompt from '../handlers/handlerPrompt';
import Toolbar from './toolbar';
import Button from './button';

import '../../../node_modules/codemirror/lib/codemirror.css';
import 'codemirror/addon/dialog/dialog.css';
import '../../less/main.less';

export default class Markmirror extends React.Component {
  static propTypes = {
    /**
     * The markdown text to render.
     */
    value:             PropTypes.string,
    /**
     * The inital markdown text to render.
     */
    defaultValue:      PropTypes.string,
    /**
     * Name given to the textarea.
     */
    name:              PropTypes.string,
    /**
     * The styling theme. Possible values are "light" and "dark".
     */
    theme:             PropTypes.string,
    /**
     * Translations for the strings used by the editor.
     */
    i18n:              PropTypes.object,
    /**
     * True to make the editor read only.
     */
    readOnly:          PropTypes.bool,
    /**
     * Number of spaces that make up a tab.
     */
    tabSize:           PropTypes.number,
    /**
     * True to use tabs, false to use spaces.
     */
    indentWithTabs:    PropTypes.bool,
    /**
     * True to display line numbers.
     */
    lineNumbers:       PropTypes.bool,
    /**
     * True to wrap long lines.
     */
    lineWrapping:      PropTypes.bool,
    /**
     * Whether to highlight the active line.
     */
    styleActiveLine:   PropTypes.bool,
    /**
     * True to show the search related buttons.
     */
    showSearch:        PropTypes.bool,
    /**
     * Options passed to the internal CodeMirror instance.
     */
    codemirrorOptions: PropTypes.object,
    /**
     * Event handlers passed to the internal CodeMirror instance.
     */
    codemirrorEvents:  PropTypes.object,
    /**
     * List of mime types for files which may be dropped/uploaded.
     */
    acceptedFileTypes: PropTypes.array,
    /**
     * Class passed to the root element.
     */
    className:         PropTypes.string,
    /**
     * Called when a change is made.
     */
    onChange:          PropTypes.func,
    /**
     * Called when there is activity on the cursor.
     */
    onCursor:          PropTypes.func,
    /**
     * Called when files are dropped on the editor.
     */
    onFiles:           PropTypes.oneOfType([PropTypes.func, PropTypes.object, PropTypes.string]),
    /**
     * Called when prompting the client for input.
     */
    onPrompt:          PropTypes.func,
    /**
     * Called in order to display the preview.
     */
    onPreview:         PropTypes.func,
    /**
     * Renders each toolbar button.
     */
    renderToolbar:     PropTypes.func,
    /**
     * Renders the toolbar.
     */
    renderButton:      PropTypes.func,
  };

  static defaultProps = {
    name:              '',
    value:             '',
    theme:             'light',
    i18n:              enLocale,
    tabSize:           2,
    readOnly:          false,
    indentWithTabs:    false,
    lineNumbers:       false,
    lineWrapping:      true,
    styleActiveLine:   true,
    showSearch:        true,
    codemirrorOptions: {},
    codemirrorEvents:  {},
    acceptedFileTypes: [],
    className:         '',
    renderToolbar:     null,
    renderButton:      null,
    onFiles:           null,
    onPreview:         null,
    onPrompt:          handlerPrompt,
    onChange:          () => {},
    onCursor:          () => {},
  };

  static handlerDataURI = handlerDataURI;
  static handlerUpload = handlerUpload;
  static handlerPrompt = handlerPrompt;

  /**
   * Constructor
   *
   * @param {*} props
   */
  constructor(props) {
    super(props);
    commands.setProps(props);
    commands.setLocale(props.i18n);

    this.rootRef = null;
    this.fileRef = null;
    this.codemirrorRef = null;
    this.codemirror = null;
    this.preview = null;
    this.state = {
      cursor:    {},
      isPreview: false,
      isFocused: false,
    };
  }

  /**
   * Invoked immediately after a component is mounted.
   */
  componentDidMount() {
    this.setupCodemirror();
  }

  componentDidUpdate(prevProps) {
    if (prevProps.theme !== this.props.theme) {
      this.setupCodemirror();
    }
    if (prevProps.defaultValue !== this.props.defaultValue && this.codemirror) {
      this.codemirror.setValue(this.props.defaultValue);
    }
  }

  /**
   * Invoked immediately before a component is unmounted and destroyed
   */
  componentWillUnmount() {
    this.destroyCodemirror();
  }

  /**
   * Initializes the codemirror instance
   */
  setupCodemirror() {
    this.destroyCodemirror();
    const themes = this.props.theme.split(',').map(s => s.trim());
    let theme = 'default';
    for (let i = 0; i < themes.length; i++) {
      if (THEMES.indexOf(themes[i]) === -1) {
        theme = themes[i];
        break;
      }
    }

    const options = objectAssign(
      {
        theme,
        mode:            'markdown',
        readOnly:        this.props.readOnly,
        tabSize:         this.props.tabSize,
        lineNumbers:     this.props.lineNumbers,
        lineWrapping:    this.props.lineWrapping,
        indentWithTabs:  this.props.indentWithTabs,
        styleActiveLine: this.props.styleActiveLine,
      },
      this.props.codemirrorOptions,
    );

    this.codemirror = CodeMirror.fromTextArea(this.codemirrorRef, options);
    this.codemirror.setValue(this.props.value);
    this.codemirror.on('change', this.handleCodemirrorChange);
    this.codemirror.on('focus', this.handleCodemirrorFocus);
    this.codemirror.on('blur', this.handleCodemirrorBlur);
    this.codemirror.on('drop', this.handleCodemirrorDrop);
    this.codemirror.on('cursorActivity', this.handleCodemirrorCursorActivity);
    objectForEach(this.props.codemirrorEvents, (handler, event) => {
      this.codemirror.on(event, handler);
    });
  }

  /**
   * Destroys the codemirror instance
   */
  destroyCodemirror() {
    if (this.codemirror) {
      this.codemirror.toTextArea();
      this.codemirror = null;
    }
  }

  /**
   * Returns the current value
   *
   * @returns {String}
   */
  get value() {
    return this.codemirror.getValue();
  }

  /**
   * Sets the current value
   *
   * @param {String} v
   */
  set value(v) {
    this.codemirror.setValue(v);
  }

  /**
   * Gives focus to the codemirror view.
   */
  focus = () => {
    if (this.codemirror) {
      this.codemirror.focus();
    }
  };

  /**
   * Executes the given command
   *
   * @param {String} command
   * @param {Event}  [e]
   */
  execCommand = (command, e) => {
    if (e) e.preventDefault();
    commands.execCommand(this.codemirror, command);
  };

  /**
   * Called when the upload button is clicked
   */
  commandUpload = () => {
    if (this.props.onFiles) {
      this.fileRef.click();
    }
  };

  /**
   * Switches between full screen
   */
  commandFullScreen = () => {
    if (!isFullScreen()) {
      requestFullscreen(this.rootRef);
      cssAddClass(this.rootRef, `${CSS_PREFIX}--fullscreen`);
    } else {
      exitFullscreen();
      cssRemoveClass(this.rootRef, `${CSS_PREFIX}--fullscreen`);
    }
  };

  /**
   * Switches between code and preview mode
   */
  commandPreview = () => {
    const isPreview = !this.state.isPreview;
    if (isPreview) {
      this.preview = this.props.onPreview(this.value);
      this.destroyCodemirror();
    }
    this.setState({ isPreview }, () => {
      if (!isPreview) {
        this.setupCodemirror();
      }
    });
  };

  /**
   * Bound to the CodeMirror 'focus' event
   */
  handleCodemirrorFocus = () => {
    this.setState({ isFocused: true });
  };

  /**
   * Bound to the CodeMirror 'blur' event
   */
  handleCodemirrorBlur = () => {
    this.setState({ isFocused: false });
  };

  /**
   * Bound to the CodeMirror 'cursorActivity' event
   */
  handleCodemirrorCursorActivity = () => {
    const cursor = commands.getCursorState(this.codemirror);
    this.props.onCursor(cursor);
    this.setState({ cursor });
  };

  /**
   * Bound to the CodeMirror 'change' event
   */
  handleCodemirrorChange = () => {
    this.props.onChange(this.codemirror.getValue());
  };

  /**
   * Bound to the CodeMirror 'drop' event
   *
   * @param {CodeMirror} codemirror
   * @param {Event} e
   */
  handleCodemirrorDrop = (codemirror, e) => {
    e.preventDefault();

    const files = [];
    const data = e.dataTransfer;
    if (data.items) {
      for (let i = 0; i < data.items.length; i++) {
        files.push(data.items[i].getAsFile());
      }
    } else {
      for (let i = 0; i < data.files; i++) {
        files.push(data.files[i]);
      }
    }

    this.handleFiles(files);
  };

  /**
   * Uploads one or more files
   *
   * @param {File[]} files
   */
  handleFiles = (files) => {
    let { onFiles, acceptedFileTypes } = this.props; // eslint-disable-line
    if (!onFiles) {
      return;
    }
    if (typeof onFiles !== 'function') {
      onFiles = handlerUpload(onFiles);
    }

    for (let i = 0; i < files.length; i++) {
      const mime = files[i].type;
      if (acceptedFileTypes.length === 0 || acceptedFileTypes.some(v => mimeIsMatch(v, mime))) {
        onFiles(files[i])
          .then((result) => {
            if (mimeTypeIsMatch(result.type, DROP_TYPE_IMAGE)) {
              this.codemirror.replaceSelection(`![${result.text}](${result.url})`);
            } else {
              this.codemirror.replaceSelection(`[${result.text}](${result.url})`);
            }
          })
          .catch((err) => {
            this.codemirror.replaceSelection(`${this.props.i18n.uploadError}: ${err}`);
          });
      }
    }
  };

  /**
   * Called when the hidden file input changes
   *
   * @param {Event} e
   */
  handleFileChange = (e) => {
    if (e.target.files.length > 0) {
      this.handleFiles(e.target.files);
    }
  };

  /**
   * Renders a toolbar button
   *
   * @param {String} command
   * @param {Function} handler
   * @returns {XML}
   */
  renderButton = (command, handler) => {
    const pressed =
      this.state.cursor[command] ||
      (command === commands.CMD_FULL && isFullScreen()) ||
      (command === commands.CMD_PREVIEW && this.state.isPreview);

    if (!handler) {
      if (command === commands.CMD_FULL) {
        handler = this.commandFullScreen;
      } else if (command === commands.CMD_UPLOAD) {
        handler = this.commandUpload;
      } else if (command === commands.CMD_PREVIEW) {
        handler = this.commandPreview;
      } else {
        handler = this.execCommand.bind(this, command);
      }
    }

    const title = this.props.i18n[`${command}Title`];
    const label = this.props.i18n[`${command}Label`];
    if (this.props.renderButton) {
      return this.props.renderButton(this, command, handler, pressed, title, label);
    }
    return <Button type="button" command={command} handler={handler} pressed={pressed} title={title} label={label} />;
  };

  /**
   * Renders the toolbar
   *
   * @returns {XML}
   */
  renderToolbar = () => {
    const show = {
      [commands.CMD_H1]:      true,
      [commands.CMD_H2]:      true,
      [commands.CMD_H3]:      true,
      [commands.CMD_BOLD]:    true,
      [commands.CMD_ITALIC]:  true,
      [commands.CMD_QUOTE]:   true,
      [commands.CMD_OLIST]:   true,
      [commands.CMD_ULIST]:   true,
      [commands.CMD_LINK]:    true,
      [commands.CMD_IMAGE]:   true,
      [commands.CMD_FULL]:    isSupported(),
      [commands.CMD_FIND]:    this.props.showSearch,
      [commands.CMD_PREVIEW]: this.props.onPreview !== null,
      [commands.CMD_UPLOAD]:  this.props.onFiles !== null,
    };

    if (this.props.renderToolbar) {
      return this.props.renderToolbar(this, this.renderButton, show);
    }
    return <Toolbar show={show} renderButton={this.renderButton} />;
  };

  renderPreview = () => (
    <div className={`${CSS_PREFIX}__editor ${CSS_PREFIX}--preview`}>
      <div className="CodeMirror" dangerouslySetInnerHTML={{ __html: this.preview }} />
    </div>
  );

  /**
   * @returns {XML}
   */
  render() {
    const { value, name, onFiles, className, ...props } = this.props;
    const { isPreview, isFocused } = this.state;

    const themes = this.props.theme.split(',').map(s => s.trim());
    let theme = 'light';
    for (let i = 0; i < themes.length; i++) {
      if (THEMES.indexOf(themes[i]) !== -1) {
        theme = themes[i];
        break;
      }
    }

    return (
      <div
        {...objectKeyFilter(props, Markmirror.propTypes)}
        ref={(ref) => {
          this.rootRef = ref;
        }}
        className={classNames(CSS_PREFIX, `${CSS_PREFIX}--${theme}-theme`, className)}
        allowFullScreen
      >
        {this.renderToolbar()}
        {isPreview ? (
          this.renderPreview()
        ) : (
          <div
            className={classNames(`${CSS_PREFIX}__editor`, {
              [`${CSS_PREFIX}__editor--focused`]: isFocused,
            })}
          >
            <textarea
              ref={(ref) => {
                this.codemirrorRef = ref;
              }}
              name={name}
              defaultValue={value}
              autoComplete="off"
            />
          </div>
        )}
        {!onFiles ? null : (
          <input
            type="file"
            style={{ display: 'none' }}
            ref={(ref) => {
              this.fileRef = ref;
            }}
            onChange={this.handleFileChange}
          />
        )}
      </div>
    );
  }
}
