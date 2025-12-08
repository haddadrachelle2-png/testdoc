const { getPool } = require("../config/db");

module.exports = {
  async createDocument(title, content, doc_num, doc_date, number_papers,sender_id, is_admin_group, destinationGroups) {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("title", title)
      .input("content", content).input("doc_num", doc_num).input("doc_date", doc_date)
      .input("number_papers", number_papers).input("is_admin_group", is_admin_group)
      .input("sender_id", sender_id).query(`
                INSERT INTO documents (title, content, doc_num, doc_date, number_papers, sender_id)
                OUTPUT INSERTED.id
                VALUES (@title, @content, @doc_num, @doc_date, @number_papers,  @sender_id)
            `);

    const documentId = result.recordset[0].id;

    for (const groupId of destinationGroups) {
      await pool
        .request()
        .input("document_id", documentId)
        .input("group_id", groupId).query(`
                    INSERT INTO document_destinations (document_id, group_id)
                    VALUES (@document_id, @group_id)
                `);
    }

    return documentId;
  },

  async getEditableDocument(documentId, userId) {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("id", documentId)
      .input("sender_id", userId).query(`
                SELECT * FROM documents
                WHERE id=@id AND sender_id=@sender_id AND is_sent=0
            `);
    return result.recordset[0];
  },

  async updateDraft(documentId, title, doc_num, doc_date, number_papers,content, destinations) {
    const pool = await getPool();
    //const safeDocDate = doc_date ? new Date(doc_date) : null;
    // Update main document
    await pool
      .request()
      .input("id", documentId)
      .input("title", title)
      .input("content", content)
      .input("doc_num", doc_num)
      
      .input("doc_date", doc_date)
      .input("number_papers", number_papers)
      .query(
        `UPDATE documents SET title=@title, content=@content, doc_num=@doc_num, doc_date=@doc_date, number_papers=@number_papers WHERE id=@id AND is_sent=0`
      );

    // Delete existing destinations
    await pool
      .request()
      .input("document_id", documentId)
      .query(
        `DELETE FROM document_destinations WHERE document_id=@document_id`
      );

    // Add new destinations
    for (const groupId of destinations) {
      await pool
        .request()
        .input("document_id", documentId)
        .input("group_id", groupId)
        .query(
          `INSERT INTO document_destinations (document_id, group_id) VALUES (@document_id,@group_id)`
        );
    }

    return documentId;
  },
};
