import isEqual from "lodash/isEqual";
import orderBy from "lodash/orderBy";
import find from "lodash/find";
import filter from "lodash/filter";
import uniq from "lodash/uniq";

/******************************************************
 * TRANSFORM RAW DATA INTO PIVOTED ROWS
 ******************************************************/
export const dataToRows = (data, pivot, groups, value, id) => {
  const pivot_values = uniq(data.map((row) => row[pivot]));

  let columns = [...groups, ...pivot_values, "_ids"];
  let out = [];
  let used_groups = [];

  data.forEach((row) => {
    const cur_group = groups.map((g) => row[g]);

    const key = Object.fromEntries(groups.map((g, i) => [g, cur_group[i]]));

    const exists = find(used_groups, (ug) => isEqual(ug, key));
    if (!exists) {
      const filtered = filter(data, key);
      const pivots = pivot_values.map((p) => find(filtered, { [pivot]: p }));

      out.push([
        ...cur_group,
        ...pivots.map((p) => (p && p[value] ? p[value] : null)),
        JSON.stringify(pivots.map((p) => (p && p[id] ? p[id] : null))),
      ]);

      used_groups.push(key);
    }
  });

  return {
    columns,
    data: out,
    groups,
    id,
    value,
    pivot_values,
  };
};

/******************************************************
 * FIXED — RELIABLE, EXACT DEDUPE OF CELL CHANGES
 ******************************************************/
export const changesToData = (array_data, changes, row_total = false) => {
  const { data, value, groups, id } = array_data;

  const map = new Map();

  changes.forEach((change) => {
    const key = `${change[0]}-${change[1]}`;
    map.set(key, {
      row: change[0],
      column: change[1],
      new_val: change[3],
    });
  });

  return Array.from(map.values()).map((item) => {
    const row = data[item.row];
    const adjust = row_total ? -1 : 0;

    const id_index = item.column - groups.length + adjust;

    const data_id = JSON.parse(row[row.length - 1])[id_index];

    return {
      [id]: data_id,
      [value]: item.new_val,
    };
  });
};

/******************************************************
 * ROW TOTALS
 ******************************************************/
export const applyRow = (formatted_data) => {
  let { data, groups, columns } = formatted_data;

  const insert_index = columns.indexOf(groups[groups.length - 1]) + 1;

  columns.splice(insert_index, 0, "Row Total");

  const last_pivot_col = columns.length - 2;

  data.forEach((row, i) => {
    row.splice(
      insert_index,
      0,
      `=SUM(${cellToGrid(insert_index + 1, i)}:${cellToGrid(last_pivot_col, i)})`
    );
  });

  return {
    ...formatted_data,
    data,
    columns,
    row_total_column: insert_index,
  };
};

/******************************************************
 * SUBTOTALS
 ******************************************************/
export const applySub = (formatted_data) => {
  let { data, groups, columns } = formatted_data;

  const last_group_index = columns.indexOf(groups[groups.length - 1]);

  let operations = [];
  let sub_total_rows = [];

  groups
    .slice()
    .reverse()
    .forEach((g, j) => {
      const idx = columns.indexOf(g);

      let last_cell = data[0][idx];
      let stack = [];

      if (j > 0) {
        data.forEach((row, i) => {
          const curr = row[idx];

          if (curr !== last_cell) {
            operations.push({
              label: last_cell,
              column: idx,
              index: i,
              stack,
            });
            stack = [i];
          } else {
            stack.push(i);
          }
          last_cell = curr;
        });

        operations.push({
          label: last_cell,
          column: idx,
          index: data.length,
          stack,
        });
      }
    });

  operations = orderBy(operations, ["index", "column"], ["asc", "desc"]);

  let inserts = 0;

  operations.forEach((o) => {
    const subtotal_row = Array.from({ length: columns.length }).map((_, i) => {
      if (i === o.column) return `${o.label} Total`;

      if (i > last_group_index && i < columns.length - 1) {
        return `=SUM(${o.stack
          .map((s) => cellToGrid(i, s + inserts))
          .join(",")})`;
      }

      return "";
    });

    data.splice(o.index + inserts, 0, subtotal_row);
    sub_total_rows.push(o.index + inserts);

    inserts++;
  });

  return {
    ...formatted_data,
    data,
    columns,
    sub_total_rows,
  };
};

/******************************************************
 * GRAND TOTAL
 ******************************************************/
export const applyGrand = (formatted_data) => {
  let { data, groups, columns, pivot_values, row_total_column } =
    formatted_data;

  const id_column_index = columns.indexOf("_ids");
  const filtered_rows = [...data.keys()].filter(
    (i) => data[i][id_column_index]
  );

  let pivot_cols = pivot_values.map((pv) => columns.indexOf(pv));

  if (row_total_column && row_total_column > -1) {
    pivot_cols.unshift(row_total_column);
  }

  const sums = pivot_cols.map((cp) =>
    filtered_rows.map((r) => cellToGrid(cp, r))
  );

  data.push([
    ...groups.map((g, i) => (i === 0 ? "Grand Total" : "")),
    ...sums.map((s) => `=SUM(${s.join(",")})`),
  ]);

  return {
    ...formatted_data,
    data,
    grand_total_row: data.length - 1,
  };
};

/******************************************************
 * FIXED COLUMN → LETTER (A → Z → AA → AB…)
 ******************************************************/
const colToLetter = (col) => {
  let letters = "";
  while (col >= 0) {
    letters = String.fromCharCode((col % 26) + 65) + letters;
    col = Math.floor(col / 26) - 1;
  }
  return letters;
};

export const cellToGrid = (col, row) => {
  return `${colToLetter(col)}${row + 1}`;
};
