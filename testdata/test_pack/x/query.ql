/**
 * @name Test query
 * @description Test query description
 * @kind table
 * @id test/query/id
 */

import y.MyLib

from int i
where i in [0 .. 2]
select i, smallPlusOne(i)
