/**
 * @name Test query 1
 * @kind table
 * @id test/query/one
 */

import y.MyLib

from int i
where i in [0 .. 2]
select i, smallPlusOne(i)
