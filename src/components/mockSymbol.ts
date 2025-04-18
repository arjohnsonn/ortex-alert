type Props = {
  symbol: string;
};

const mockSymbol = (props: Props) => {
  return `
    <div class="MuiDataGrid-cell MuiDataGrid-cell--textLeft" role="cell" data-field="symbol" data-colindex="0">
      <div class=" TableCell_TableCell__ofBYs">
        <div class=" TableCell_container__RJgLi">
          <p style="color: rgb(128, 128, 128);">${props.symbol}</p>
        </div>
      </div>
    </div>
  `;
};

export default mockSymbol;
