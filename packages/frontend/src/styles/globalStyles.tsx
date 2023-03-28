import { createGlobalStyle } from 'styled-components';

const StyledGlobal = createGlobalStyle`
    table, th, td {
      //width: 950px;
      border: 1px solid;
      border-collapse: collapse;
    }

    td label {
      display: block;
      margin: 4px;
    }
    
    table input {
      display: block;
      border: none;
      padding-left: 10px;
      margin: 0;
      height: 27px; // todo: remove hardcode
      background-color: ivory;
    }
`;
export default StyledGlobal;
