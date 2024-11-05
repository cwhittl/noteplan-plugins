// @flow
//--------------------------------------------------------------------------
// Dashboard React component to show an HTML DropdownSelect control, with various possible settings.
// Based on basic HTML controls, not a fancy React Component.
//--------------------------------------------------------------------------
import React, { useState, useEffect, useRef, type ElementRef } from 'react'
import './DropdownSelect.css'
import { clo, logDebug } from '@helpers/react/reactDev'

declare var NP_THEME: any

export type Option = {
  label: string,
  value: string,
  [string]: any, // Allow additional properties
}

type Styles = {
  container?: { [string]: mixed },
  label?: { [string]: mixed },
  wrapper?: { [string]: mixed },
  inputContainer?: { [string]: mixed },
  input?: { [string]: mixed },
  arrow?: { [string]: mixed },
  dropdown?: { [string]: mixed },
  option?: { [string]: mixed },
  indicator?: { [string]: mixed }, // Style for the indicator
}

type DropdownSelectProps = {
  label: string,
  options: Array<string | Option>,
  value: string | Option,
  onChange: ({ [string]: mixed }) => void,
  inputRef?: { current: null | HTMLInputElement },
  compactDisplay?: boolean,
  disabled?: boolean,
  styles?: Styles,
  fullWidthOptions?: boolean,
  showIndicatorOptionProp?: string,
  allowNonMatchingLabel?: boolean,
}

/**
 * Safely merges two style objects, giving precedence to the second.
 *
 * @param {Object} baseStyles - The base styles.
 * @param {Object} overrideStyles - The styles to override with.
 * @returns {Object} The merged style object.
 */
const mergeStyles = (baseStyles: { [string]: mixed }, overrideStyles: { [string]: mixed } = {}) => {
  return { ...baseStyles, ...overrideStyles }
}

const DropdownSelect = ({
  label,
  options,
  disabled,
  value,
  onChange,
  inputRef,
  compactDisplay = false,
  styles = {},
  fullWidthOptions = false,
  showIndicatorOptionProp = '',
}: DropdownSelectProps): React$Node => {
  // Normalize options to a consistent format

  const normalizeOption: (option: string | Option) => Option = (option) => {
    return typeof option === 'string' ? { label: option, value: option } : option
  }
  const normalizedOptions: Array<Option> = options.map(normalizeOption)

  const [isOpen, setIsOpen] = useState(false)
  const [selectedValue, setSelectedValue] = useState(normalizeOption(value))
  const dropdownRef = useRef<?ElementRef<'div'>>(null)
  const optionsRef = useRef<?ElementRef<'div'>>(null)

  //----------------------------------------------------------------------
  // Handlers
  //----------------------------------------------------------------------

  const toggleDropdown = () => setIsOpen(!isOpen)

  const handleOptionClick = (option: Option) => {
    setSelectedValue(option)
    // $FlowFixMe[incompatible-call]
    onChange(option)
    setIsOpen(false)
  }

  const handleClickOutside = (event: MouseEvent) => {
    const target = event.target
    if (dropdownRef.current && target instanceof Node && !dropdownRef.current.contains(target)) {
      setIsOpen(false)
    }
  }

  //----------------------------------------------------------------------
  // Effects
  //----------------------------------------------------------------------

  useEffect(() => {
    setSelectedValue(normalizeOption(value)) // We need to allow for the value to be something that is not in the options (like Work*)
  }, [value, normalizedOptions])

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const findScrollableAncestor = (el: HTMLElement): ?HTMLElement => {
    let currentEl: ?Element = el
    while (currentEl && currentEl.parentElement) {
      currentEl = currentEl.parentElement
      if (currentEl instanceof HTMLElement) {
        const style = window.getComputedStyle(currentEl)
        const overflowY = style.overflowY
        const isScrollable = (overflowY === 'auto' || overflowY === 'scroll') && currentEl.scrollHeight > currentEl.clientHeight
        if (isScrollable) {
          return currentEl
        }
      }
    }
    return null
  }

  useEffect(() => {
    if (isOpen && dropdownRef.current && optionsRef.current) {
      setTimeout(() => {
        if (!dropdownRef.current || !optionsRef.current) return
        const dropdown: HTMLElement = dropdownRef.current
        const options: HTMLElement = optionsRef.current

        const dropdownRect = dropdown.getBoundingClientRect()
        const optionsRect = options.getBoundingClientRect()

        const totalTop = Math.min(dropdownRect.top, optionsRect.top)
        const totalBottom = Math.max(dropdownRect.bottom, optionsRect.bottom)

        const totalRect = {
          top: totalTop,
          bottom: totalBottom,
        }

        const scrollableContainer = findScrollableAncestor(dropdown)

        if (scrollableContainer) {
          const containerRect = scrollableContainer.getBoundingClientRect()

          const isOutOfView = totalRect.bottom > containerRect.bottom || totalRect.top < containerRect.top

          if (isOutOfView) {
            let offset = scrollableContainer.scrollTop + (totalRect.bottom - containerRect.bottom)
            if (totalRect.top < containerRect.top) {
              offset = scrollableContainer.scrollTop - (containerRect.top - totalRect.top)
            }
            scrollableContainer.scrollTo({
              top: offset,
              behavior: 'smooth',
            })
          }
        }
      }, 100)
    }
  }, [isOpen])

  // Determine if the selected option should show the indicator
  const selectedOption = normalizedOptions.find((option) => option.value === selectedValue.value)
  const shouldShowIndicator = showIndicatorOptionProp && selectedOption ? selectedOption[showIndicatorOptionProp] === true : false

  //----------------------------------------------------------------------
  // Indicator Style Function
  //----------------------------------------------------------------------
  /**
   * Returns style object for the dot indicator.
   *
   * @param {boolean} isVisible - Whether the indicator should be visible.
   * @param {Object} customStyles - Custom styles for the indicator.
   * @returns {Object} Style object for the dot.
   */
  const dot = (isVisible: boolean, customStyles: { [string]: mixed } = {}) =>
    // $FlowFixMe[cannot-spread-indexer]
    ({
      backgroundColor: isVisible ? customStyles.color || 'black' : 'transparent',
      borderRadius: '50%',
      height: 10,
      width: 10,
      marginRight: 8,
      display: 'inline-block',
      flexShrink: 0,
      ...customStyles,
    })

  return (
    <div
      className={`${compactDisplay ? 'combobox-container-compact' : 'combobox-container'} ${disabled ? 'disabled' : ''}`}
      ref={dropdownRef}
      style={mergeStyles({}, styles.container)}
    >
      <label className="combobox-label" style={mergeStyles({}, styles.label)}>
        {label}
      </label>
      <div className="combobox-wrapper" style={mergeStyles({}, styles.wrapper)} onClick={disabled ? undefined : toggleDropdown}>
        <div
          className="combobox-input-container"
          style={mergeStyles(
            {
              display: 'flex',
              alignItems: 'center',
              position: 'relative',
            },
            styles.inputContainer || {},
          )}
        >
          {showIndicatorOptionProp && <span style={dot(shouldShowIndicator, styles.indicator || {})} />}
          <input
            type="text"
            className="combobox-input"
            value={selectedValue?.label || ''}
            readOnly
            ref={inputRef}
            disabled={disabled}
            style={mergeStyles({ paddingLeft: showIndicatorOptionProp ? '24px' : '8px' }, styles.input)}
          />
        </div>
        <span className="combobox-arrow" style={mergeStyles({}, styles.arrow)}>
          &#9662;
        </span>
        {isOpen && (
          <div className="combobox-dropdown" ref={optionsRef} style={mergeStyles({ width: fullWidthOptions ? '100%' : 'auto' }, styles.dropdown)}>
            {normalizedOptions.map((option: Option) => {
              const showIndicator = showIndicatorOptionProp && option.hasOwnProperty(showIndicatorOptionProp)
              return (
                <div
                  key={option.value}
                  className="combobox-option"
                  onClick={() => handleOptionClick(option)}
                  style={mergeStyles(
                    {
                      display: 'flex',
                      alignItems: 'center',
                    },
                    styles.option,
                  )}
                >
                  {showIndicator && <span style={dot(option[showIndicatorOptionProp] === true, styles.indicator || {})} />}
                  <span>{option.label}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default DropdownSelect
