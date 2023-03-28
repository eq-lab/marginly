import { FC, useContext, useState } from 'react';
import { SignerContext } from '../connection';
import { increaseForkBlockCall, increaseForkTimeCall } from '../contracts/calls/ganache';

enum TimeMeasureUnit {
  Second = 'Second',
  Minute = 'Minute',
  Hour = 'Hour',
  Day = 'Day',
  Month = 'Month',
  Year = 'Year',
}

export const TimeShift: FC = () => {
  const [currentBlock, setCurrentBlock] = useState<number>(0);
  const [currentDate, setCurrentDate] = useState<string>('');
  const [currentTimestamp, setCurrentTimestamp] = useState<number>(0);
  const [blockShiftValue, setBlockShiftValue] = useState<string>('');
  const [timeShiftValue, setTimeShiftValue] = useState<string>('');
  const [measureUnit, setMeasureUnit] = useState<TimeMeasureUnit>(TimeMeasureUnit.Hour);
  const signerContext = useContext(SignerContext);

  const shiftBlock = () => {
    if (signerContext === undefined) {
      console.warn(`signerContext is not set`);
      return;
    }
    if (blockShiftValue === '') {
      console.warn(`Block shift value is not set`);
      return;
    }
    let shiftValue = Number.parseInt(blockShiftValue);

    if (shiftValue === 0) {
      console.warn(`Block shift value === 0`);
      return;
    }

    increaseForkBlockCall(signerContext.provider, shiftValue).then((_) => fetchTime());
  };

  const shiftTime = () => {
    if (signerContext === undefined) {
      console.warn(`signerContext is not set`);
      return;
    }
    if (timeShiftValue === '') {
      console.warn(`Time shift value is not set`);
      return;
    }
    let shiftValue = Number.parseInt(timeShiftValue);

    if (shiftValue === 0) {
      console.warn(`Time shift value === 0`);
      return;
    }

    switch (measureUnit) {
      case TimeMeasureUnit.Second:
        break;
      case TimeMeasureUnit.Minute:
        shiftValue = shiftValue * 60;
        break;
      case TimeMeasureUnit.Hour:
        shiftValue = shiftValue * 3600;
        break;
      case TimeMeasureUnit.Day:
        shiftValue = shiftValue * 86400;
        break;
      case TimeMeasureUnit.Month:
        shiftValue = shiftValue * 2592000;
        break;
      case TimeMeasureUnit.Year:
        shiftValue = shiftValue * 31104000;
        break;
    }
    increaseForkTimeCall(signerContext.provider, shiftValue).then((_) => fetchTime());
  };

  const fetchTime = () => {
    if (signerContext === undefined) {
      console.warn(`signerContext is not set`);
      return;
    }
    const provider = signerContext.provider;
    provider.getBlockNumber().then((blockNumber) =>
      provider.getBlock(blockNumber).then((block) => {
        setCurrentBlock(blockNumber);
        setCurrentTimestamp(block.timestamp);
        const date = new Date(block.timestamp * 1000);
        setCurrentDate(`${date.getHours()}:${date.getMinutes()}:${date.getSeconds()} ${date.toLocaleDateString()}`);
      })
    );
  };

  return (
    <div style={{ display: 'inline-block' }}>
      <b>Time</b>
      <table>
        <tbody>
          <tr>
            <td>
              <label>Current date</label>
            </td>
            <td style={{ width: '100px' }}>
              <label>{currentDate}</label>
            </td>
            <td>
              <button onClick={(_) => fetchTime()}>Fetch</button>
            </td>
          </tr>
          <tr>
            <td>
              <label>Current timestamp</label>
            </td>
            <td style={{ width: '100px' }}>
              <label>{currentTimestamp}</label>
            </td>
            <td />
          </tr>
          <tr>
            <td>
              <label>Current block</label>
            </td>
            <td style={{ width: '100px' }}>
              <label>{currentBlock}</label>
            </td>
            <td />
          </tr>
          <tr>
            <td>
              <label>Time shift</label>
            </td>
            <td style={{ width: '100px' }}>
              <input
                style={{ width: '90%' }}
                type={'number'}
                value={timeShiftValue}
                onChange={(e) => setTimeShiftValue(e.target.value)}
              />
              <select
                style={{ width: '100px' }}
                onChange={(e) => setMeasureUnit(e.target.value as TimeMeasureUnit)}
                value={measureUnit}
              >
                {Object.keys(TimeMeasureUnit).map((x) => (
                  <option key={`option-${x}`} value={x}>
                    {x}
                  </option>
                ))}
              </select>
            </td>
            <td>
              <button onClick={(_) => shiftTime()}>Increase</button>
            </td>
          </tr>
          <tr>
            <td>
              <label>Block shift</label>
            </td>
            <td style={{ width: '100px' }}>
              <input
                style={{ width: '90%' }}
                type={'number'}
                value={blockShiftValue}
                onChange={(e) => setBlockShiftValue(e.target.value)}
              />
            </td>
            <td>
              <button onClick={(_) => shiftBlock()}>Increase</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};
