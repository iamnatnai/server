const excel = require("exceljs");
const DocEXCEL = async (req, res) => {
  const farmerStyles = {
    header: {
      font: { bold: true, size: 12, color: { argb: "FFFFFF" } }, // ตัวอักษรหนา ขนาด 12 สีขาว
      alignment: { horizontal: "center" },
      fill: { type: "pattern", pattern: "solid", fgColor: { argb: "2E74B5" } }, // สีเขียว
    },
    downloadRow: {
      font: { bold: true, size: 10, color: { argb: "000000" } }, // ตัวอักษรหนา ขนาด 10 สีดำ
      alignment: { horizontal: "right" },
      fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFD966" } }, // สีเหลือง
    },
    totalRow: {
      font: { bold: true, size: 10, color: { argb: "000000" } }, // ตัวอักษรหนา ขนาด 10 สีดำ
      alignment: { horizontal: "right" },
      fill: { type: "pattern", pattern: "solid", fgColor: { argb: "CCFFCC" } }, // สีเขียวอ่อน
    },
    middleRow: {
      font: { bold: true, size: 11, color: { argb: "0000FF" } }, // ตัวอักษรหนา ขนาด 11 สีน้ำเงิน
      alignment: { horizontal: "right" },
      fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FFFF00" } }, // สีเหลือง
    },
    THEBEST: {
      font: { bold: true, size: 50, color: { argb: "0000FF" } },
      alignment: { horizontal: "center", vertical: "middle" },
      fill: { type: "pattern", pattern: "solid", fgColor: { argb: "a4ffa4" } }, // สีเหลือง
    },
  };
  try {
    await usePooledConnectionAsync(async (db) => {
      // Query data of farmers
      const farmerSqlQuery = `
          SELECT 
            f.id AS farmer_id, 
            f.email, 
            f.username, 
            f.firstname, 
            f.lastname, 
            f.farmerstorename, 
            f.phone,
            COUNT(p.product_id) AS product_count
          FROM 
            farmers f
          LEFT JOIN 
            products p ON f.id = p.farmer_id
          GROUP BY
            f.id, f.email, f.username, f.firstname, f.lastname, f.farmerstorename, f.phone
        `;

      const farmersData = await new Promise((resolve, reject) => {
        db.query(farmerSqlQuery, (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        });
      });

      const workbook = new excel.Workbook();

      const farmerWorksheet = workbook.addWorksheet("Farmers", {
        properties: { tabColor: { argb: "FF00BFFF" } },
        pageSetup: { paperSize: 9, orientation: "landscape" },
      });
      farmerWorksheet.mergeCells("A1:H1");
      farmerWorksheet.getCell("A1").value = "THE BEST KASET NONT";

      farmerWorksheet.eachRow((row) => {
        row.eachCell((cell) => {
          cell.font = farmerStyles.THEBEST.font;
          cell.alignment = farmerStyles.THEBEST.alignment;
          cell.fill = farmerStyles.THEBEST.fill;
        });
      });
      momentz.locale("th"); // กำหนดภาษาเป็นไทย
      const downloadDate = momentz
        .tz("Asia/Bangkok")
        .format("DD-MM-YYYY HH:mm:ss");
      const totalFarmers = farmersData.length;

      const downloadRow = farmerWorksheet.addRow([
        "ข้อมูลออกณวันที่ :",
        downloadDate,
        "",
        "",
        "",
        "",
        "",
        "",
      ]);
      const totalRow = farmerWorksheet.addRow([
        "จำนวนเกษตรกรทั้งหมด :",
        totalFarmers,
        "",
        "",
        "",
        "",
        "",
        "",
      ]);
      farmerWorksheet.columns.forEach((column) => {
        column.width = 25;
      });
      const farmerHeaders = [
        "รหัสเกษตรกร",
        "อีเมล",
        "ชื่อผู้ใช้เกษตรกร",
        "ชื่อจริง",
        "นามสกุล",
        "ชื่อร้านค้า",
        "หมายเลขโทรศัพท์",
        "สินค้าที่ขายทั้งหมด",
      ];

      const headerRow = farmerWorksheet.addRow(farmerHeaders);
      headerRow.eachCell((cell) => {
        cell.font = farmerStyles.header.font;
        cell.alignment = farmerStyles.header.alignment;
        cell.fill = farmerStyles.header.fill;
      });

      farmerWorksheet.columns.forEach((column) => {
        column.width = 25;
      });

      farmerWorksheet.views = [
        { state: "frozen", xSplit: 0, ySplit: 1, activeCell: "B2" },
      ];

      const farmerProductSheets = {};

      farmersData.forEach((row) => {
        const rowData = [
          row.farmer_id,
          row.email,
          row.username,
          row.firstname,
          row.lastname,
          row.farmerstorename,
          row.phone,
          row.product_count,
        ];
        const farmerRow = farmerWorksheet.addRow(rowData);

        farmerWorksheet.getCell(`A${farmerRow.number}`).value = {
          text: row.farmer_id,
          hyperlink: `#Products_${row.farmer_id}!A1`,
          tooltip: `Go to Products for ${row.farmer_id}`,
        };

        const productSheet = workbook.addWorksheet(
          `Products_${row.farmer_id}`,
          {
            properties: { tabColor: { argb: "FF00FF00" } },
          }
        );
        const productHeaders = [
          "รหัสสินค้า",
          "ชื่อสินค้า",
          "คงเหลือในคลัง",
          "ราคา",
        ];
        const productHead = productSheet.addRow(productHeaders);
        productHead.eachCell((cell) => {
          cell.font = farmerStyles.header.font;
          cell.alignment = farmerStyles.header.alignment;
          cell.fill = farmerStyles.header.fill;
        });

        productSheet.columns.forEach((column) => {
          column.width = 20;
        });
        farmerProductSheets[row.farmer_id] = productSheet;
      });

      for (const farmerId in farmerProductSheets) {
        const productSheet = farmerProductSheets[farmerId];
        const productsSqlQuery = `
            SELECT 
              product_id, 
              product_name, 
              stock, 
              price
            FROM 
              products
            WHERE 
              farmer_id = ?
          `;
        const productsData = await new Promise((resolve, reject) => {
          db.query(productsSqlQuery, [farmerId], (err, result) => {
            if (err) {
              reject(err);
            } else {
              resolve(result);
            }
          });
        });

        productsData.forEach((product) => {
          const productData = [
            product.product_id,
            product.product_name,
            product.stock,
            product.price,
          ];
          const productRow = productSheet.addRow(productData);

          // แต่งสไตล์ของแถวข้อมูลในตาราง Product
          productRow.eachCell((cell) => {
            cell.font = farmerStyles.middleRow.font;
            cell.alignment = farmerStyles.middleRow.alignment;
            cell.fill = farmerStyles.middleRow.fill;
          });
        });

        // เพิ่มลิงก์ที่ชี้กลับไปยังหน้ารายการเกษตรกร
        productSheet.getCell(`E${productSheet.lastRow.number}`).value = {
          text: "กลับไปหน้าหลัก",
          hyperlink: "#Farmers!A1",
          tooltip: "Go back to Farmers",
          font: { color: { argb: "0000FF" }, underline: true },
          alignment: { vertical: "middle", horizontal: "center" },
          border: {
            top: { style: "thin", color: { argb: "000000" } },
            left: { style: "thin", color: { argb: "000000" } },
            bottom: { style: "thin", color: { argb: "000000" } },
            right: { style: "thin", color: { argb: "000000" } },
          },
          fill: {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFF00" }, // สีเหลือง
          },
          onClick: () => {
            window.location.href = "#Farmers!A1";
          }, // กระทำเมื่อคลิกที่ปุ่ม
        };
      }

      downloadRow.eachCell((cell) => {
        cell.font = farmerStyles.downloadRow.font;
        cell.alignment = farmerStyles.downloadRow.alignment;
        cell.fill = farmerStyles.downloadRow.fill;
      });
      totalRow.eachCell((cell) => {
        cell.font = farmerStyles.totalRow.font;
        cell.alignment = farmerStyles.totalRow.alignment;
        cell.fill = farmerStyles.totalRow.fill;
      });

      const currentDate = moment().format("YYYY-MM-DD_HH-mm-ss");
      const filename = `farmers_and_products_${currentDate}.xlsx`;

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`
      );
      await workbook.xlsx.write(res);
      res.end();
    });
  } catch (error) {
    console.error("Error generating excel:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};
module.exports = {
  DocEXCEL,
};
