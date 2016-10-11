/* global Mousetrap */
const URI = require('urijs');

const CodeMirror = require('codemirror/lib/codemirror');

require('codemirror/mode/sql/sql');
require('codemirror/addon/mode/simple');

// search
require('codemirror/addon/dialog/dialog');
require('codemirror/addon/search/searchcursor');
require('codemirror/addon/search/search');

// print margin
require('codemirror/addon/display/rulers');

// trailing whitespace
require('codemirror/addon/edit/trailingspace');

// folding
require('codemirror/addon/fold/foldcode');
require('codemirror/addon/fold/foldgutter');
require('./codemirror-fold-beancount.js');

// auto-complete
require('codemirror/addon/hint/show-hint');
require('./codemirror-hint-beancount.js');

require('./codemirror-mode-beancount.js');

function saveEditorContent(cm) {
  const $button = $('#source-editor-submit');
  const fileName = $('#source-editor-select').val();
  $button
      .attr('disabled', 'disabled')
      .text('Saving...');

  $.ajax({
    type: 'PUT',
    url: $button.data('url'),
    data: {
      file_path: fileName,
      source: cm.getValue(),
    },
  })
    .done((data) => {
      if (!data.success) {
        alert(`Writing to\n\n\t${fileName}\n\nwas not successful.`);
      } else {
        $button
            .removeAttr('disabled')
            .text('Save');
        cm.focus();
      }
    });
}

function formatEditorContent(cm) {
  const $button = $('#source-editor-format');
  const scrollPosition = cm.getScrollInfo().top;

  $button.attr('disabled', 'disabled');
  const url = $button.attr('data-url');
  $.post(url, {
    source: cm.getValue(),
  })
    .done((data) => {
      if (data.success) {
        cm.setValue(data.payload);
        cm.scrollTo(null, scrollPosition);
      } else {
        alert('There was an error formatting the file with bean-format.');
      }
      $button.removeAttr('disabled');
    });
}

function centerCursor(cm) {
  const top = cm.cursorCoords(true, 'local').top;
  const height = cm.getScrollInfo().clientHeight;
  cm.scrollTo(null, top - (height / 2));
}

function jumpToMarker(cm) {
  const cursor = cm.getSearchCursor('FAVA-INSERT-MARKER');

  if (cursor.findNext()) {
    cm.focus();
    cm.setCursor(cursor.pos.from);
    cm.execCommand('goLineUp');
    centerCursor(cm);
  } else {
    cm.setCursor(cm.lastLine(), 0);
  }
}


module.exports.initEditor = function initEditor() {
  const rulers = [];
  if (window.editorPrintMarginColumn) {
    rulers.push({
      column: window.editorPrintMarginColumn,
      lineStyle: 'dotted',
    });
  }

  const defaultOptions = {
    mode: 'beancount',
    indentUnit: 4,
    lineNumbers: true,
    rulers,
    foldGutter: true,
    showTrailingSpace: true,
    gutters: ['CodeMirror-linenumbers', 'CodeMirror-foldgutter'],
    extraKeys: {
      'Ctrl-Space': 'autocomplete',
      'Ctrl-S': (cm) => {
        saveEditorContent(cm);
      },
      'Cmd-S': (cm) => {
        saveEditorContent(cm);
      },
      'Ctrl-D': (cm) => {
        formatEditorContent(cm);
      },
      'Cmd-D': (cm) => {
        formatEditorContent(cm);
      },
      Tab: (cm) => {
        if (cm.somethingSelected()) {
          cm.indentSelection('add');
        } else {
          cm.execCommand('insertSoftTab');
        }
      },
    },
  };

  const readOnlyOptions = {
    mode: 'beancount',
    readOnly: true,
  };

  const queryOptions = {
    mode: 'text/x-sql',
    lineNumbers: true,
    extraKeys: {
      'Ctrl-Enter': () => {
        $('#submit-query').click();
      },
      'Cmd-Enter': () => {
        $('#submit-query').click();
      },
    },
  };

  // Read-only editors
  $('.editor-readonly').each((i, el) => {
    CodeMirror.fromTextArea(el, readOnlyOptions);
  });

  // Query editor
  if ($('#query-editor').length) {
    const editor = CodeMirror.fromTextArea(document.getElementById('query-editor'), queryOptions);

    // when the focus is outside the editor
    Mousetrap.bind(['ctrl+enter', 'meta+enter'], (event) => {
      event.preventDefault();
      $('#submit-query').click();
    });

    $('.stored-queries select').change((event) => {
      const sourceElement = $('.stored-queries a.source-link');
      const query = $(event.currentTarget).val();
      const sourceLink = $('option:selected', event.currentTarget).attr('data-source-link');

      editor.setValue(query);
      sourceElement.attr('href', sourceLink).toggle(query !== '');
    });
  }

  // The /source/ editor
  if ($('#source-editor').length) {
    const el = document.getElementById('source-editor');
    const editor = CodeMirror.fromTextArea(el, defaultOptions);

    editor.on('keyup', (cm, event) => {
      if (!cm.state.completionActive && event.keyCode !== 13) {
        CodeMirror.commands.autocomplete(cm, null, { completeSingle: false });
      }
    });
    const line = parseInt(new URI(location.search).query(true).line, 10);
    if (line > 0) {
      editor.setCursor(line - 1, 0);
      centerCursor(editor);
    } else {
      jumpToMarker(editor);
    }

    $('#source-editor-select').change((event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      const $select = $(event.currentTarget);
      $select.attr('disabled', 'disabled');
      const filePath = $select.val();
      $.get($select.parents('form').attr('action'), {
        file_path: filePath,
      })
        .done((data) => {
          editor.setValue(data);
          editor.setCursor(0, 0);
          $select.removeAttr('disabled');
          jumpToMarker(editor);
        });
    });

    // keybindings when the focus is outside the editor
    Mousetrap.bind(['ctrl+s', 'meta+s'], (event) => {
      event.preventDefault();
      saveEditorContent(editor);
    });

    Mousetrap.bind(['ctrl+d', 'meta+d'], (event) => {
      event.preventDefault();
      formatEditorContent(editor);
    });

    $('#source-editor-submit').click((event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      saveEditorContent(editor);
    });

    $('#source-editor-format').click((event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      formatEditorContent(editor);
    });
  }
};
