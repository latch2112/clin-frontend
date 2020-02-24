import React from 'react';
import {
  Row, Col, InputNumber, Slider,
} from 'antd';

import PropTypes from 'prop-types';
import styleFilter from '../../styles/filter.module.scss';

class NumericalComparisonWidget extends React.Component {
  constructor(props) {
    super(props);
    this.state = {};
  }

  render() {
    const {
      onMinValueChange,
      onMaxValueChange,
      onSliderValueChange,
      defaultLow,
      defaultHigh,
      currentLow,
      currentHigh,
      sliderDisabled,
      inputDisabled,
      min,
      max,
    } = this.props;

    console.log('Widget - props: ', this.props);
    return (
      <>
        <Row className={styleFilter.rangeSlider}>
          <Slider
            range
            defaultValue={[defaultLow, defaultHigh]}
            min={min}
            max={max}
            step={0.01}
            disabled={sliderDisabled}
            onChange={onSliderValueChange}
          />
        </Row>
        <Row type="flex" justify="space-between" className={styleFilter.rangeInput}>
          <Col>
            <InputNumber
              step={0.01}
              value={currentLow}
              min={min}
              max={currentHigh}
              defaultValue={defaultLow}
              onChange={onMinValueChange}
              disabled={inputDisabled}
            />
          </Col>
          <Col>
            <InputNumber
              step={0.01}
              value={currentHigh}
              min={currentLow}
              max={max}
              defaultValue={defaultHigh}
              onChange={onMaxValueChange}
              disabled={inputDisabled}
            />
          </Col>
        </Row>
      </>
    );
  }
}

NumericalComparisonWidget.propTypes = {
  onMinValueChange: PropTypes.func.isRequired,
  onMaxValueChange: PropTypes.func.isRequired,
  onSliderValueChange: PropTypes.func.isRequired,
  defaultLow: PropTypes.number.isRequired,
  defaultHigh: PropTypes.number.isRequired,
  currentLow: PropTypes.number.isRequired,
  currentHigh: PropTypes.number.isRequired,
  sliderDisabled: PropTypes.bool.isRequired,
  inputDisabled: PropTypes.number.isRequired,
  min: PropTypes.number.isRequired,
  max: PropTypes.number.isRequired,
};

export default NumericalComparisonWidget;