// @flow
//----------------------------------------------------------
// Dashboard React component to show a piece of text in the Settings and Dropdowns
// TODO: This needs more thought on classNames of what it returns, as it is now being used by Settings more than Dropdowns (if at all).
// Last updated 2024-08-15 for v2.1.0.a8 by @jgclark
//----------------------------------------------------------

import React from 'react'

type TextComponentProps = {
  label: string,
  textType: 'title' | 'description' | 'separator' | 'header',
  description?: string,
};

const TextComponent = ({ label, textType, description }: TextComponentProps): React$Node => {
  switch (textType) {
    case 'title':
      return <div className="dropdown-title">{label}</div>
    case 'header':
      return (
        <>
          <div className="ui-heading">{label}</div>
          {description && (
            <p className="item-description">{description}</p>
          )}
        </>
      )
    case 'description':
      return <p className="item-description">{label}</p>
    case 'separator':
      return <hr className="ui-separator" />
    default:
      return null
  }
}

export default TextComponent
