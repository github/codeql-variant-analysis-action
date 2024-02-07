/**
 * @name Test query 2
 * @kind table
 * @id test/query/two
 */

import y.MyLib

from int i
where i in [0 .. 2]
select i, smallPlusOne(i)
