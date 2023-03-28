import * as React from 'react';
import { FC } from 'react';
import styled from 'styled-components';

export type TabSelectorProps = {
  tabs: string[];
  selectedTab: string;
  setSelectedTab: (tab: string) => void;
};

const StyledButton = styled.button.attrs((props) => ({ isSelected: props.className === 'selected' }))`
  border-style: none;
  background: ${(props) => (props.isSelected ? '#E67E22' : 'none')};
`;

export const TabSelector: FC<TabSelectorProps> = ({ tabs, selectedTab, setSelectedTab }) => {
  return (
    <div>
      {tabs.map((x) => (
        <StyledButton
          key={`tab-selector-${x}`}
          onClick={(_) => setSelectedTab(x)}
          className={x === selectedTab ? 'selected' : ''}
        >
          <h4>{x}</h4>
        </StyledButton>
      ))}
    </div>
  );
};
