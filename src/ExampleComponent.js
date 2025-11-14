import { licenseKey } from '../config.json';
import React, { useCallback, useEffect, useState } from 'react';
import './styles.css'
import isEqual from 'lodash/isEqual'
import find from 'lodash/find'
import filter from 'lodash/filter'
import { HotTable, HotColumn } from "@handsontable/react";
import "handsontable/dist/handsontable.min.css";
import { registerPlugin, AutoColumnSize, Autofill, ColumnSummary, ColumnSorting, ManualColumnFreeze, ContextMenu, DropdownMenu, UndoRedo} from 'handsontable/plugins';
import { HyperFormula } from 'hyperformula';
import { applyGrand, applyRow, applySub, changesToData, dataToRows } from './helpers';
registerPlugin(AutoColumnSize);
registerPlugin(Autofill);
registerPlugin(ColumnSummary);
registerPlugin(ColumnSorting );
registerPlugin(ManualColumnFreeze);
registerPlugin(ContextMenu);
registerPlugin(DropdownMenu);
registerPlugin(UndoRedo);

const hf = HyperFormula.buildEmpty({
    // to use an external HyperFormula instance,
    // initialize it with the `'internal-use-in-handsontable'` license key
    licenseKey: 'internal-use-in-handsontable',
});
const sheetName = hf.addSheet("main");
const sheetId = hf.getSheetId(sheetName);



const ExampleSpreadsheet = ({ triggerQuery, model, modelUpdate }) => {
    const [data, setData] = useState([]);
    const [formatted_data, setFormattedData] = useState([]);
    const [all_changes, setAllChanges] = useState([])
    

    useEffect(()=>{
        if (!isEqual(model.data,data)) {
            refreshData();
        }
    },[model])

    useEffect(()=>{
        if (all_changes && all_changes.length) {
            const updated_data = changesToData(
                formatted_data, 
                all_changes,
                (model.totals.row_total)?model.totals.row_total:false
            )
            modelUpdate({updated_data})
        }
    },[all_changes])

    const refreshData = () => {
        if (model.data) {
            setData(model.data);
            setAllChanges([]);
            modelUpdate({updated_data: []})
            let formatted = dataToRows(model.data, model.pivot,model.groups, model.value, model.id)
            if (model.totals && formatted && formatted.data && formatted.data.length) {
                if (model.totals.row_total) { formatted = applyRow(formatted) };
                if (model.totals.sub_total) formatted = applySub(formatted);
                if (model.totals.grand_total) { formatted = applyGrand(formatted) };
            }
            setFormattedData(formatted);
            if (formatted && formatted.data && formatted.data.length) {
                hf.setSheetContent(sheetId, formatted.data);
            }
        }
    }
const afterChange = (changes, type) => {
  if (type === 'loadData') return;

  if (['edit', 'Autofill.fill', 'CopyPaste.cut', 'CopyPaste.paste'].includes(type)) {
    setAllChanges(prev => {
      const newMap = new Map();

      // Keep previous values but keyed by row/col
      prev.forEach(ch => newMap.set(`${ch[0]}-${ch[1]}`, ch));

      // Insert new changes (overwrite older)
      changes.forEach(ch => newMap.set(`${ch[0]}-${ch[1]}`, ch));

      return Array.from(newMap.values());
    });
  }
};


    const columnSummaryStyle = (row, col) => {
        if (!formatted_data) return {}
        let classNames = [];
        if (all_changes.length) {
          
            const found = all_changes.filter(o=> o[0]===row && o[1]===col)
            if (found.length) {
              return {className: 'changed_cell'}
            }
        }
        if (formatted_data.grand_total_row && row === formatted_data.grand_total_row) {
            classNames.push('grand_total')
        }
        if (formatted_data.row_total_column && col === formatted_data.row_total_column) {
            classNames.push('row_total')
        }
        if (formatted_data.sub_total_rows && formatted_data.sub_total_rows.indexOf(row) > -1) {
            classNames.push('sub_total')
        }
        if (classNames.length) {
            return {className: classNames.join(' '), readOnly: true}
        } else {
            return {}
        }
    }

    if (formatted_data.data && formatted_data.data.length) {
        return  <div style={{height: '100vh', width: '100vw'}}>
        <HotTable
            columnSorting={(Boolean(model.columnSorting))}
            undoRedo={true}
            contextMenu={(Boolean(model.contextMenu))}
            manualColumnFreeze={(model.fixedColumnsLeft && Number(model.fixedColumnsLeft)>0)?true:false}
            fixedColumnsLeft={(model.fixedColumnsLeft && Number(model.fixedColumnsLeft)>0)?model.fixedColumnsLeft:0}
            data={formatted_data.data}
            licenseKey={licenseKey}
            colWidths={model.colWidths}
            autoColumnSize={true}
            fillHandle={{
                autoInsertRow: false,
                autoInsertColumn: false
            }}
            cells={columnSummaryStyle}
            afterChange={afterChange}
            allowInsertRow={false}
            allowInsertColumn={false}
            formulas={{engine: hf, sheetName}}
            colHeaders={formatted_data.columns.map(c=>{
                if (model.labels) {
                    return model.labels[model.fields.indexOf(c)] || c
                }
                return c
            })}
        >
        {formatted_data.columns.map((c,i)=>{
            if (c!=='_ids') {
                return <HotColumn 
                    key={c} 
                    data={i}
                    readOnly={model.groups.indexOf(c)>-1}
                    type={(model.groups.indexOf(c)>-1)?"numeric":"text"}
                />
            } else {
                return <React.Fragment key={c} />
            }
        })}
    </HotTable>

        </div>  

    } else {
        return <React.Fragment />
    }
return <></>
}
export default ExampleSpreadsheet;