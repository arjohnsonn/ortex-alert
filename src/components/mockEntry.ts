type Props = {
  timeDisplay: string;
  expiryDate: string;
  strike: number;
  type: string;
  size: number;
  price: number;
  formattedTotalValue: string;
  reason: string;
};

const mockEntry = (props: Props) => {
  const {
    timeDisplay,
    expiryDate,
    strike,
    type,
    size,
    price,
    formattedTotalValue,
    reason,
  } = props;

  return `<div class="MuiDataGrid-cell--withRenderer MuiDataGrid-cell MuiDataGrid-cell--textLeft MuiDataGrid-withBorderColor" role="cell" data-field="time" data-colindex="0" aria-colindex="1" aria-colspan="1" tabindex="-1" style="min-width: 120px; max-width: 120px; min-height: auto; max-height: none;">
      <div class="jsx-1989257464 TableCell_TableCell__ofBYs " style="margin: inherit;">
        <div class="jsx-1989257464 TableCell_left__Mdoca TableCell_container__RJgLi false ">
          <div class="jsx-1989257464 " style="cursor: initial;">
            <p class="jsx-1989257464">${timeDisplay}</p>
          </div>
        </div>
      </div>
    </div>
    <div class="MuiDataGrid-cell--withRenderer MuiDataGrid-cell MuiDataGrid-cell--textLeft MuiDataGrid-withBorderColor" role="cell" data-field="expiry date" data-colindex="1" aria-colindex="2" aria-colspan="1" tabindex="-1" style="min-width: 120px; max-width: 120px; min-height: auto; max-height: none;">
      <div class="jsx-1989257464 TableCell_TableCell__ofBYs " style="margin: inherit;">
        <div class="jsx-1989257464 TableCell_left__Mdoca TableCell_container__RJgLi false ">
          <div class="jsx-1989257464 " style="cursor: initial;">
            <p class="jsx-1989257464">${expiryDate}</p>
          </div>
        </div>
      </div>
    </div>
    <div class="MuiDataGrid-cell--withRenderer MuiDataGrid-cell MuiDataGrid-cell--textLeft MuiDataGrid-withBorderColor" role="cell" data-field="strike" data-colindex="2" aria-colindex="3" aria-colspan="1" tabindex="-1" style="min-width: 120px; max-width: 120px; min-height: auto; max-height: none;">
      <div class="jsx-1989257464 TableCell_TableCell__ofBYs " style="margin: inherit;">
        <div class="jsx-1989257464 TableCell_nowrap__zqT_T TableCell_millify__lkjHT TableCell_container__RJgLi false ">
          <div class="jsx-1989257464 " style="cursor: initial;">
            <p class="jsx-1989257464">${strike}</p>
          </div>
        </div>
      </div>
    </div>
    <div class="MuiDataGrid-cell--withRenderer MuiDataGrid-cell MuiDataGrid-cell--textLeft MuiDataGrid-withBorderColor" role="cell" data-field="call/put" data-colindex="3" aria-colindex="4" aria-colspan="1" tabindex="-1" style="min-width: 120px; max-width: 120px;
min-height: auto; max-height: none;">
      <div class="jsx-1989257464 TableCell_TableCell__ofBYs " style="margin: inherit;">
        <div class="jsx-1989257464 TableCell_container__RJgLi false ">
          <div class="jsx-1989257464 " style="cursor: initial;">
            <p class="jsx-1989257464">${type === "C" ? "C" : "P"}</p>
          </div>
        </div>
      </div>
    </div>
    <div class="MuiDataGrid-cell--withRenderer MuiDataGrid-cell MuiDataGrid-cell--textLeft MuiDataGrid-withBorderColor" role="cell" data-field="size" data-colindex="4" aria-colindex="5" aria-colspan="1" tabindex="-1" style="min-width: 120px; max-width: 120px; min-height: auto; max-height: none;">
      <div class="jsx-1989257464 TableCell_TableCell__ofBYs " style="margin: inherit;">
        <div class="jsx-1989257464 TableCell_nowrap__zqT_T TableCell_millify__lkjHT TableCell_container__RJgLi false ">
          <div class="jsx-1989257464 " style="cursor: initial;">
            <p class="jsx-1989257464">${size}</p>
          </div>
        </div>
      </div>
    </div>
    <div class="MuiDataGrid-cell--withRenderer MuiDataGrid-cell MuiDataGrid-cell--textLeft MuiDataGrid-withBorderColor" role="cell" data-field="price" data-colindex="5" aria-colindex="6" aria-colspan="1" tabindex="-1" style="min-width: 120px; max-width: 120px; min-height: auto; max-height: none;">
      <div class="jsx-1989257464 TableCell_TableCell__ofBYs " style="margin: inherit;">
        <div class="jsx-1989257464 TableCell_nowrap__zqT_T TableCell_millify__lkjHT TableCell_container__RJgLi false ">
          <div class="jsx-1989257464 " style="cursor: initial;">
            <p class="jsx-1989257464">${price}</p>
          </div>
        </div>
      </div>
    </div>
    <div class="MuiDataGrid-cell--withRenderer MuiDataGrid-cell MuiDataGrid-cell--textLeft MuiDataGrid-withBorderColor" role="cell" data-field="total value" data-colindex="6" aria-colindex="7" aria-colspan="1" tabindex="-1" style="min-width: 120px; max-width: 120px; min-height: auto; max-height: none;">
      <div class="jsx-1989257464 TableCell_TableCell__ofBYs " style="margin: inherit;">
        <div class="jsx-1989257464 TableCell_nowrap__zqT_T TableCell_millify__lkjHT TableCell_container__RJgLi false ">
          <div class="jsx-1989257464 " style="cursor: initial;">
            <p class="jsx-1989257464">${formattedTotalValue}</p>
          </div>
        </div>
      </div>
    </div>
    <div class="MuiDataGrid-cell--withRenderer MuiDataGrid-cell MuiDataGrid-cell--textLeft MuiDataGrid-withBorderColor" role="cell" data-field="reason" data-colindex="7" aria-colindex="8" aria-colspan="1" tabindex="-1" style="min-width: 120px; max-width: 120px; min-height: auto; max-height: none;">
      <div class="jsx-1989257464 TableCell_TableCell__ofBYs " style="margin: inherit;">
        <div class="jsx-1989257464 TableCell_container__RJgLi false ">
          <div class="jsx-1989257464 " style="cursor: initial;">
            <p class="jsx-1989257464">${reason}</p>
          </div>
        </div>
      </div>
    </div>`;
};

export default mockEntry;
